import type {
  Client,
  Guild,
  GuildBasedChannel,
  OverwriteResolvable,
  TextChannel,
} from 'discord.js';
import { logger } from '../../utils/logger';
import type { ChannelAccess, CommandHandler, DiscordGateway, GatewayMessage } from './gateway';

/** Un salon ou un rôle qu'on veut supprimer et qui n'existe déjà plus : ce n'est pas une erreur. */
const UNKNOWN_CODES = new Set([10003, 10011]); // Unknown Channel, Unknown Role

function isUnknown(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    UNKNOWN_CODES.has(Number((err as { code: unknown }).code))
  );
}

/**
 * Adaptateur discord.js. La bibliothèque est chargée à la demande : sans pont configuré,
 * le serveur ne la charge jamais.
 */
export async function connectDiscord(token: string, guildId: string): Promise<DiscordGateway> {
  const discord = await import('discord.js');
  const {
    ChannelType,
    Client,
    Events,
    GatewayIntentBits,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
  } = discord;

  const client: Client = new Client({
    // MessageContent est un intent privilégié : il faut l'activer sur le portail développeur,
    // sinon Discord refuse la connexion. Il ne sert qu'à l'archivage des salons.
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  const ready = new Promise<void>((resolve) => client.once(Events.ClientReady, () => resolve()));
  await client.login(token);
  await ready;
  const guild: Guild = await client.guilds.fetch(guildId);
  const botId = client.user!.id;

  const overwritesFor = (access: ChannelAccess): OverwriteResolvable[] => {
    const everyone = guild.roles.everyone.id;
    if (access.mode === 'private') {
      return [
        { id: everyone, deny: [PermissionFlagsBits.ViewChannel] },
        ...(access.roleIds ?? []).map((id) => ({
          id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
          ],
        })),
        {
          id: botId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ];
    }
    if (access.mode === 'read-only') {
      return [
        {
          id: everyone,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
        {
          id: botId,
          allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages],
        },
      ];
    }
    return [];
  };

  const channel = async (id: string): Promise<GuildBasedChannel | null> => {
    try {
      return await guild.channels.fetch(id);
    } catch (err) {
      if (isUnknown(err)) return null;
      throw err;
    }
  };

  const gateway: DiscordGateway = {
    guildId,
    guildName: guild.name,

    async createCategory(name) {
      const created = await guild.channels.create({ name, type: ChannelType.GuildCategory });
      return created.id;
    },
    async createTextChannel(name, parentId, access) {
      const created = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parentId,
        permissionOverwrites: overwritesFor(access),
      });
      return created.id;
    },
    async createVoiceChannel(name, parentId, access) {
      const created = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: parentId,
        permissionOverwrites: overwritesFor(access),
      });
      return created.id;
    },
    async createRole(name) {
      const role = await guild.roles.create({ name, mentionable: false });
      return role.id;
    },
    async deleteChannel(id) {
      const target = await channel(id);
      if (target)
        await target.delete().catch((err) => (isUnknown(err) ? undefined : Promise.reject(err)));
    },
    async deleteRole(id) {
      try {
        const role = await guild.roles.fetch(id);
        if (role) await role.delete();
      } catch (err) {
        if (!isUnknown(err)) throw err;
      }
    },
    async channelExists(id) {
      return (await channel(id)) !== null;
    },

    async addRole(userId, roleId) {
      const member = await guild.members.fetch(userId);
      await member.roles.add(roleId);
    },
    async removeRole(userId, roleId) {
      try {
        const member = await guild.members.fetch(userId);
        await member.roles.remove(roleId);
      } catch (err) {
        if (!isUnknown(err)) throw err;
      }
    },

    async sendMessage(channelId, content, options) {
      const target = await channel(channelId);
      if (!target || !target.isTextBased()) return;
      const message = await (target as TextChannel).send(content);
      if (options?.pin) await message.pin().catch(() => undefined);
    },
    async *fetchMessages(channelId): AsyncIterable<GatewayMessage> {
      const target = await channel(channelId);
      if (!target || !target.isTextBased()) return;
      const text = target as TextChannel;
      // Discord pagine par 100, du plus récent au plus ancien : on remonte, puis on renverse.
      const all: GatewayMessage[] = [];
      let before: string | undefined;
      for (;;) {
        const page = await text.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (page.size === 0) break;
        for (const message of page.values()) {
          if (message.author.id === botId) continue;
          all.push({
            authorName: message.member?.displayName ?? message.author.username,
            at: message.createdAt.toISOString(),
            content: message.content,
          });
        }
        before = page.last()?.id;
        if (page.size < 100) break;
      }
      for (const message of all.reverse()) yield message;
    },

    channelUrl(channelId) {
      return `https://discord.com/channels/${guildId}/${channelId}`;
    },

    async registerCommands(handler: CommandHandler) {
      await guild.commands.set([
        new SlashCommandBuilder()
          .setName('rejoindre')
          .setDescription('Ouvre les salons de ton équipe avec son code HackaMetz')
          .addStringOption((option) =>
            option
              .setName('code')
              .setDescription('Le code d’équipe (6 caractères)')
              .setRequired(true),
          )
          .toJSON(),
        new SlashCommandBuilder()
          .setName('quitter')
          .setDescription('Ferme l’accès aux salons de ton équipe')
          .toJSON(),
      ]);
      client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'rejoindre' && interaction.commandName !== 'quitter')
          return;
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const reply = await handler({
            name: interaction.commandName,
            userId: interaction.user.id,
            userName: interaction.user.username,
            code: interaction.options.getString('code') ?? undefined,
          });
          await interaction.editReply(reply);
        } catch (err) {
          logger.error({ err }, 'Discord : interaction en échec');
        }
      });
    },

    async stop() {
      await client.destroy();
    },
  };

  return gateway;
}
