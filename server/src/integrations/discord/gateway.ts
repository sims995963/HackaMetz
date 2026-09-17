/**
 * Ce que le pont attend de Discord, et rien de plus. L'implémentation réelle enveloppe
 * discord.js ; les tests en fournissent une en mémoire.
 */
export interface ChannelAccess {
  /**
   * `private` : invisible à tous sauf aux rôles listés ; `read-only` : visible de tous,
   * seul le bot écrit ; `open` : hérite de la catégorie.
   */
  mode: 'private' | 'read-only' | 'open';
  roleIds?: string[];
}

export interface GatewayMessage {
  authorName: string;
  at: string;
  content: string;
}

export interface SlashCommand {
  name: 'rejoindre' | 'quitter';
  userId: string;
  userName: string;
  code?: string;
}

export type CommandHandler = (command: SlashCommand) => Promise<string>;

export interface DiscordGateway {
  readonly guildId: string;
  readonly guildName: string;

  createCategory(name: string): Promise<string>;
  createTextChannel(name: string, parentId: string, access: ChannelAccess): Promise<string>;
  createVoiceChannel(name: string, parentId: string, access: ChannelAccess): Promise<string>;
  createRole(name: string): Promise<string>;
  /** Tolérant : un salon ou un rôle déjà supprimé à la main n'est pas une erreur. */
  deleteChannel(id: string): Promise<void>;
  deleteRole(id: string): Promise<void>;
  channelExists(id: string): Promise<boolean>;

  addRole(userId: string, roleId: string): Promise<void>;
  removeRole(userId: string, roleId: string): Promise<void>;

  sendMessage(channelId: string, content: string, options?: { pin?: boolean }): Promise<void>;
  /** Du plus ancien au plus récent. */
  fetchMessages(channelId: string): AsyncIterable<GatewayMessage>;

  channelUrl(channelId: string): string;
  registerCommands(handler: CommandHandler): Promise<void>;
  stop(): Promise<void>;
}
