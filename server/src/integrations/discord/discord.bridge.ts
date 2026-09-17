import type {
  Announcement,
  DiscordInfo,
  DiscordLink,
  DiscordStatus,
  Hackathon,
  HackathonStatus,
  Team,
  TeamDiscord,
} from '@hackametz/shared';
import type { UserRecord } from '../../models/user.model';
import type { Repositories } from '../../repositories';
import type { HackathonStorage } from '../../storage/hackathon.storage';
import { newId } from '../../utils/ids';
import { logger } from '../../utils/logger';
import { nowIso } from '../../utils/time';
import type { IntegrationHooks } from '../hooks';
import { renderJournal } from './archive';
import type { DiscordGateway, SlashCommand } from './gateway';
import { categoryName, roleName, textChannelName, voiceChannelName } from './naming';

/** Statuts pendant lesquels l'espace Discord d'une édition existe. */
const OPEN_STATUSES: readonly HackathonStatus[] = [
  'published',
  'running',
  'submissions_closed',
  'judging',
];

/** Discord refuse plus de 50 salons par catégorie ; deux par équipe, quatre pour l'espace commun. */
const CATEGORY_CAPACITY = 50;
const CHANNELS_PER_TEAM = 2;
const EDITION_CHANNELS = 4;

export interface BridgeOptions {
  inviteUrl: string | null;
  graceHours: number;
}

/**
 * Traduit le cycle de vie de HackaMetz en salons Discord : un espace commun par édition,
 * deux salons privés par équipe ouverts par le code d'équipe, et un nettoyage complet
 * après l'édition. Toute création est idempotente : ce qui existe déjà (table `discordLinks`)
 * n'est jamais recréé, un redémarrage du serveur est sans effet.
 */
export class DiscordBridge implements IntegrationHooks {
  private state: DiscordStatus['state'] = 'connecting';
  private lastError: string | null = null;
  private openSpaces = 0;

  constructor(
    private readonly repos: Repositories,
    private readonly storage: HackathonStorage,
    private readonly gateway: DiscordGateway,
    private readonly options: BridgeOptions,
  ) {}

  // ------------------------------------------------------------------ Hooks

  async editionStatusChanged(hackathon: Hackathon): Promise<void> {
    if (OPEN_STATUSES.includes(hackathon.status)) {
      await this.ensureEditionSpace(hackathon);
      await this.catchUpTeams(hackathon);
      return;
    }
    if (hackathon.status === 'finished' || hackathon.status === 'archived') {
      await this.scheduleClose(hackathon);
    }
  }

  async teamCreated(hackathon: Hackathon, team: Team): Promise<void> {
    if (!OPEN_STATUSES.includes(hackathon.status)) return;
    await this.ensureTeamSpace(hackathon, team);
  }

  /**
   * Un départ côté HackaMetz ne dit pas quel compte Discord est concerné : le pseudo et le
   * compte Discord ne sont jamais liés. C'est `/quitter`, côté Discord, qui retire le rôle.
   */
  async memberLeft(_hackathon: Hackathon, _team: Team, _user: UserRecord): Promise<void> {
    return undefined;
  }

  async teamDissolved(_hackathon: Hackathon, team: Team): Promise<void> {
    const link = await this.repos.discordLinks.findOne(
      (l) => l.kind === 'team' && l.teamId === team.id,
    );
    if (link) await this.removeTeamSpace(link, null);
  }

  async announcementPublished(hackathon: Hackathon, announcement: Announcement): Promise<void> {
    const edition = await this.editionLink(hackathon.id);
    if (!edition?.announcementsChannelId) return;
    const content = `**${announcement.title}**\n${announcement.content}`.slice(0, 1900);
    await this.gateway.sendMessage(edition.announcementsChannelId, content, {
      pin: announcement.pinned,
    });
  }

  /** Une fois par minute : fermetures échues, et rattrapage de ce qui aurait dû être créé. */
  async tick(): Promise<void> {
    try {
      await this.closeDueSpaces();
      await this.catchUpEditions();
      this.state = 'connected';
      this.lastError = null;
    } catch (err) {
      this.failed(err);
    }
  }

  private async closeDueSpaces(): Promise<void> {
    const now = nowIso();
    const due = await this.repos.discordLinks.filter((l) => l.closeAt !== null && l.closeAt <= now);
    // Les équipes d'abord (archivage éventuel), la catégorie de l'édition en dernier.
    for (const link of due.filter((l) => l.kind === 'team')) {
      const submission = link.teamId
        ? await this.repos.submissions.findOne(
            (s) => s.ownerType === 'team' && s.ownerId === link.teamId,
          )
        : undefined;
      await this.removeTeamSpace(link, submission?.consent.archiveDiscord ? submission : null);
    }
    for (const link of due.filter((l) => l.kind === 'category')) await this.removeLink(link);
    for (const link of due.filter((l) => l.kind === 'edition')) await this.removeLink(link);
  }

  private async catchUpEditions(): Promise<void> {
    const open = await this.repos.hackathons.filter((h) => OPEN_STATUSES.includes(h.status));
    for (const hackathon of open) {
      await this.ensureEditionSpace(hackathon);
      await this.catchUpTeams(hackathon);
    }
  }

  // ---------------------------------------------------------------- Lecture

  editionInfo(hackathon: Hackathon): DiscordInfo | null {
    if (!OPEN_STATUSES.includes(hackathon.status)) return null;
    return { inviteUrl: this.options.inviteUrl };
  }

  async teamInfo(team: Team): Promise<TeamDiscord | null> {
    const link = await this.repos.discordLinks.findOne(
      (l) => l.kind === 'team' && l.teamId === team.id,
    );
    if (!link?.textChannelId) return null;
    return {
      textChannelUrl: this.gateway.channelUrl(link.textChannelId),
      voiceChannelUrl: link.voiceChannelId ? this.gateway.channelUrl(link.voiceChannelId) : null,
    };
  }

  status(): DiscordStatus {
    return {
      state: this.state,
      guildName: this.gateway.guildName,
      openSpaces: this.openSpaces,
      error: this.lastError,
    };
  }

  /** Une erreur Discord se voit dans le tableau de bord jusqu'au prochain tick réussi. */
  private failed(err: unknown): never {
    this.state = 'error';
    this.lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }

  // -------------------------------------------------------------- Commandes

  /** Réponse éphémère à `/rejoindre` et `/quitter`, en français, jamais technique. */
  async handleCommand(command: SlashCommand): Promise<string> {
    try {
      if (command.name === 'rejoindre') return await this.join(command);
      return await this.quit(command);
    } catch (err) {
      logger.error({ err, command: command.name }, 'Discord : commande en échec');
      return 'Ça n’a pas marché de notre côté. Réessaie dans un instant, ou vois avec l’organisateur.';
    }
  }

  private async join(command: SlashCommand): Promise<string> {
    const code = (command.code ?? '').trim().toUpperCase();
    if (code.length < 4)
      return 'Il me faut le code d’équipe — il est affiché dans HackaMetz, sur la carte de ton équipe.';

    const team = await this.repos.teams.findOne((t) => t.inviteCode === code);
    if (!team) return `Aucune équipe n’a le code **${code}**. Vérifie-le dans HackaMetz.`;
    const hackathon = await this.repos.hackathons.findById(team.hackathonId);
    if (!hackathon || !OPEN_STATUSES.includes(hackathon.status)) {
      return 'Cette édition n’est plus ouverte : ses salons ont été fermés.';
    }

    const link = await this.ensureTeamSpace(hackathon, team);
    if (!link.roleId)
      return 'Les salons de cette équipe ne sont pas encore prêts. Réessaie dans un instant.';
    await this.gateway.addRole(command.userId, link.roleId);
    if (!link.memberDiscordIds.includes(command.userId)) {
      await this.repos.discordLinks.update(link.id, {
        memberDiscordIds: [...link.memberDiscordIds, command.userId],
      });
    }
    const text = link.textChannelId ? `<#${link.textChannelId}>` : 'ton salon';
    return `Bienvenue dans **${team.name}** ! Tes salons sont ouverts : ${text} pour écrire, et le vocal juste en dessous.`;
  }

  private async quit(command: SlashCommand): Promise<string> {
    const links = await this.repos.discordLinks.filter(
      (l) => l.kind === 'team' && l.memberDiscordIds.includes(command.userId),
    );
    if (links.length === 0) return 'Tu n’es dans aucun salon d’équipe.';
    for (const link of links) {
      if (link.roleId) await this.gateway.removeRole(command.userId, link.roleId);
      await this.repos.discordLinks.update(link.id, {
        memberDiscordIds: link.memberDiscordIds.filter((id) => id !== command.userId),
      });
    }
    return 'C’est fait : tu ne vois plus les salons de ton équipe. `/rejoindre` avec le code pour revenir.';
  }

  // ---------------------------------------------------------------- Espaces

  private async editionLink(hackathonId: string): Promise<DiscordLink | undefined> {
    return this.repos.discordLinks.findOne(
      (l) => l.kind === 'edition' && l.hackathonId === hackathonId,
    );
  }

  private async ensureEditionSpace(hackathon: Hackathon): Promise<DiscordLink> {
    const existing = await this.editionLink(hackathon.id);
    if (existing) return existing;

    const categoryId = await this.gateway.createCategory(
      categoryName(hackathon.code, hackathon.title),
    );
    const announcementsChannelId = await this.gateway.createTextChannel('annonces', categoryId, {
      mode: 'read-only',
    });
    const textChannelId = await this.gateway.createTextChannel('accueil', categoryId, {
      mode: 'open',
    });
    const generalChannelId = await this.gateway.createTextChannel('general', categoryId, {
      mode: 'open',
    });
    const voiceChannelId = await this.gateway.createVoiceChannel('Salle commune', categoryId, {
      mode: 'open',
    });

    const link = await this.repos.discordLinks.insert({
      id: newId(),
      hackathonId: hackathon.id,
      kind: 'edition',
      teamId: null,
      categoryId,
      roleId: null,
      textChannelId,
      voiceChannelId,
      announcementsChannelId,
      extraChannelIds: [generalChannelId],
      memberDiscordIds: [],
      closeAt: null,
      createdAt: nowIso(),
    });
    await this.gateway.sendMessage(
      textChannelId,
      [
        `Bienvenue pour **#${hackathon.code} · ${hackathon.title}** !`,
        '',
        'Chaque équipe a son salon texte et son vocal, privés. Pour les ouvrir, tape ici :',
        '`/rejoindre` suivi du code de ton équipe — il est affiché dans HackaMetz, sur la carte de ton équipe.',
        '',
        `Les salons d’équipe sont supprimés ${this.options.graceHours} h après la fin de l’édition.`,
      ].join('\n'),
      { pin: true },
    );
    this.openSpaces += 1;
    logger.info({ code: hackathon.code }, 'Discord : espace de l’édition créé');
    return link;
  }

  /** Équipes créées avant que le pont ne tourne, ou création échouée une première fois. */
  private async catchUpTeams(hackathon: Hackathon): Promise<void> {
    const teams = await this.repos.teams.filter((t) => t.hackathonId === hackathon.id);
    for (const team of teams) await this.ensureTeamSpace(hackathon, team);
  }

  private async ensureTeamSpace(hackathon: Hackathon, team: Team): Promise<DiscordLink> {
    const existing = await this.repos.discordLinks.findOne(
      (l) => l.kind === 'team' && l.teamId === team.id,
    );
    if (existing) return existing;

    const edition = await this.ensureEditionSpace(hackathon);
    const categoryId = await this.pickCategory(hackathon, edition);
    const roleId = await this.gateway.createRole(roleName(hackathon.code, team.slug));
    const access = { mode: 'private' as const, roleIds: [roleId] };
    const textChannelId = await this.gateway.createTextChannel(
      textChannelName(team.name),
      categoryId,
      access,
    );
    const voiceChannelId = await this.gateway.createVoiceChannel(
      voiceChannelName(team.name),
      categoryId,
      access,
    );

    const link = await this.repos.discordLinks.insert({
      id: newId(),
      hackathonId: hackathon.id,
      kind: 'team',
      teamId: team.id,
      categoryId,
      roleId,
      textChannelId,
      voiceChannelId,
      announcementsChannelId: null,
      extraChannelIds: [],
      memberDiscordIds: [],
      closeAt: null,
      createdAt: nowIso(),
    });
    await this.gateway.sendMessage(
      textChannelId,
      [
        `Salon de l’équipe **${team.name}** pour #${hackathon.code} · ${hackathon.title}.`,
        '',
        `Il sera supprimé ${this.options.graceHours} h après la fin de l’édition.`,
        'Il ne sera archivé avec votre projet dans la base de connaissance **que si vous cochez la case au moment du dépôt**.',
        'L’organisateur peut lire ce salon.',
      ].join('\n'),
      { pin: true },
    );
    this.openSpaces += 1;
    logger.info({ code: hackathon.code, team: team.slug }, 'Discord : salons de l’équipe créés');
    return link;
  }

  /**
   * La catégorie de l'édition accueille les premières équipes ; quand elle approche des
   * 50 salons, on ouvre « · Équipes 2 », puis 3…
   */
  private async pickCategory(hackathon: Hackathon, edition: DiscordLink): Promise<string> {
    const links = await this.repos.discordLinks.filter((l) => l.hackathonId === hackathon.id);
    const used = (categoryId: string) =>
      links.filter((l) => l.kind === 'team' && l.categoryId === categoryId).length *
        CHANNELS_PER_TEAM +
      (categoryId === edition.categoryId ? EDITION_CHANNELS : 0);

    const candidates = [
      edition.categoryId,
      ...links.filter((l) => l.kind === 'category').map((l) => l.categoryId),
    ];
    for (const categoryId of candidates) {
      if (used(categoryId) + CHANNELS_PER_TEAM <= CATEGORY_CAPACITY) return categoryId;
    }

    const index = candidates.length + 1;
    const categoryId = await this.gateway.createCategory(
      categoryName(hackathon.code, hackathon.title, index),
    );
    await this.repos.discordLinks.insert({
      id: newId(),
      hackathonId: hackathon.id,
      kind: 'category',
      teamId: null,
      categoryId,
      roleId: null,
      textChannelId: null,
      voiceChannelId: null,
      announcementsChannelId: null,
      extraChannelIds: [],
      memberDiscordIds: [],
      closeAt: null,
      createdAt: nowIso(),
    });
    return categoryId;
  }

  // -------------------------------------------------------------- Fermeture

  private async scheduleClose(hackathon: Hackathon): Promise<void> {
    const links = await this.repos.discordLinks.filter(
      (l) => l.hackathonId === hackathon.id && l.closeAt === null,
    );
    if (links.length === 0) return;
    const base = Math.max(Date.now(), Date.parse(hackathon.dates.endsAt));
    const closeAt = new Date(base + this.options.graceHours * 3_600_000).toISOString();
    for (const link of links) await this.repos.discordLinks.update(link.id, { closeAt });
    const edition = links.find((l) => l.kind === 'edition');
    if (edition?.announcementsChannelId) {
      await this.gateway.sendMessage(
        edition.announcementsChannelId,
        `L’édition est terminée. Les salons d’équipe seront supprimés le ${new Date(closeAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.`,
      );
    }
    logger.info({ code: hackathon.code, closeAt }, 'Discord : fermeture programmée');
  }

  /** Archive d'abord si l'équipe l'a demandé, puis supprime salons et rôle. */
  private async removeTeamSpace(
    link: DiscordLink,
    archiveFor: { id: string; files: { sourcePath: string } } | null,
  ): Promise<void> {
    if (
      archiveFor &&
      link.textChannelId &&
      (await this.gateway.channelExists(link.textChannelId))
    ) {
      try {
        const messages = [];
        for await (const message of this.gateway.fetchMessages(link.textChannelId)) {
          messages.push(message);
        }
        await this.storage.writeProjectJournal(
          archiveFor.files.sourcePath,
          renderJournal(messages),
        );
        logger.info(
          { submission: archiveFor.id, messages: messages.length },
          'Discord : salon archivé',
        );
      } catch (err) {
        // Un archivage raté ne doit pas laisser un salon vivre éternellement.
        logger.error({ err, submission: archiveFor.id }, 'Discord : archivage impossible');
      }
    }
    await this.removeLink(link);
  }

  private async removeLink(link: DiscordLink): Promise<void> {
    for (const channelId of [
      link.textChannelId,
      link.voiceChannelId,
      link.announcementsChannelId,
      ...link.extraChannelIds,
    ]) {
      if (channelId) await this.gateway.deleteChannel(channelId);
    }
    // Supprimer une catégorie ne supprime pas ses salons : ils sont tous passés avant.
    if (link.kind === 'edition' || link.kind === 'category') {
      await this.gateway.deleteChannel(link.categoryId);
    }
    if (link.roleId) await this.gateway.deleteRole(link.roleId);
    await this.repos.discordLinks.remove(link.id);
    if (link.kind !== 'category') this.openSpaces = Math.max(0, this.openSpaces - 1);
  }

  /** Au démarrage : compter ce qui est déjà ouvert, pour l'état affiché à l'organisateur. */
  async start(): Promise<void> {
    const links = await this.repos.discordLinks.all();
    this.openSpaces = links.filter((l) => l.kind !== 'category').length;
    await this.gateway.registerCommands((command) => this.handleCommand(command));
    this.state = 'connected';
  }
}
