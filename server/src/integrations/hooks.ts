import type {
  Announcement,
  DiscordInfo,
  DiscordStatus,
  Hackathon,
  Team,
  TeamDiscord,
} from '@hackametz/shared';
import type { UserRecord } from '../models/user.model';
import { logger } from '../utils/logger';

/**
 * Port vers le monde extérieur (Discord aujourd'hui). Les services l'appellent à côté
 * du bus d'événements, sans savoir qui écoute. Par défaut, personne n'écoute.
 */
export interface IntegrationHooks {
  editionStatusChanged(hackathon: Hackathon): Promise<void>;
  teamCreated(hackathon: Hackathon, team: Team): Promise<void>;
  memberLeft(hackathon: Hackathon, team: Team, user: UserRecord): Promise<void>;
  teamDissolved(hackathon: Hackathon, team: Team): Promise<void>;
  announcementPublished(hackathon: Hackathon, announcement: Announcement): Promise<void>;
  /** Appelé par le job de cycle de vie : fermetures programmées, rattrapages. */
  tick(): Promise<void>;

  // --- Lecture : ce que l'API expose au client.
  editionInfo(hackathon: Hackathon): DiscordInfo | null;
  teamInfo(team: Team): Promise<TeamDiscord | null>;
  status(): DiscordStatus;
}

export const DISABLED_STATUS: DiscordStatus = {
  state: 'disabled',
  guildName: null,
  openSpaces: 0,
  error: null,
};

export const NOOP_HOOKS: IntegrationHooks = {
  editionStatusChanged: async () => undefined,
  teamCreated: async () => undefined,
  memberLeft: async () => undefined,
  teamDissolved: async () => undefined,
  announcementPublished: async () => undefined,
  tick: async () => undefined,
  editionInfo: () => null,
  teamInfo: async () => null,
  status: () => DISABLED_STATUS,
};

/**
 * Enveloppe un jeu de hooks : une intégration en panne ne doit jamais empêcher une équipe
 * de se créer ou une édition de changer de statut. On journalise, et on continue.
 */
export function safeHooks(hooks: IntegrationHooks): IntegrationHooks {
  const guard =
    <A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>) =>
    async (...args: A) => {
      try {
        await fn(...args);
      } catch (err) {
        logger.error({ err, hook: name }, 'Intégration : le hook a échoué');
      }
    };
  return {
    editionStatusChanged: guard('editionStatusChanged', hooks.editionStatusChanged.bind(hooks)),
    teamCreated: guard('teamCreated', hooks.teamCreated.bind(hooks)),
    memberLeft: guard('memberLeft', hooks.memberLeft.bind(hooks)),
    teamDissolved: guard('teamDissolved', hooks.teamDissolved.bind(hooks)),
    announcementPublished: guard('announcementPublished', hooks.announcementPublished.bind(hooks)),
    tick: guard('tick', hooks.tick.bind(hooks)),
    // Les lectures ne sont pas protégées : une info manquante se voit, une exception aussi.
    editionInfo: hooks.editionInfo.bind(hooks),
    teamInfo: hooks.teamInfo.bind(hooks),
    status: hooks.status.bind(hooks),
  };
}

/**
 * Point d'accroche mutable : le contexte est construit avant que le pont Discord ne
 * soit connecté (il a besoin du réseau), on branche donc les hooks après coup.
 */
export class HookRegistry implements IntegrationHooks {
  private target: IntegrationHooks = NOOP_HOOKS;

  attach(hooks: IntegrationHooks): void {
    this.target = safeHooks(hooks);
  }

  detach(): void {
    this.target = NOOP_HOOKS;
  }

  editionStatusChanged(hackathon: Hackathon) {
    return this.target.editionStatusChanged(hackathon);
  }
  teamCreated(hackathon: Hackathon, team: Team) {
    return this.target.teamCreated(hackathon, team);
  }
  memberLeft(hackathon: Hackathon, team: Team, user: UserRecord) {
    return this.target.memberLeft(hackathon, team, user);
  }
  teamDissolved(hackathon: Hackathon, team: Team) {
    return this.target.teamDissolved(hackathon, team);
  }
  announcementPublished(hackathon: Hackathon, announcement: Announcement) {
    return this.target.announcementPublished(hackathon, announcement);
  }
  tick() {
    return this.target.tick();
  }
  editionInfo(hackathon: Hackathon) {
    return this.target.editionInfo(hackathon);
  }
  teamInfo(team: Team) {
    return this.target.teamInfo(team);
  }
  status() {
    return this.target.status();
  }
}
