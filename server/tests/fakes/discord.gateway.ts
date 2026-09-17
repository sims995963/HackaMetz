import type {
  ChannelAccess,
  CommandHandler,
  DiscordGateway,
  GatewayMessage,
} from '../../src/integrations/discord/gateway';

interface FakeChannel {
  id: string;
  name: string;
  type: 'category' | 'text' | 'voice';
  parentId: string | null;
  access: ChannelAccess | null;
  messages: { content: string; pinned: boolean }[];
}

/**
 * Un Discord en mémoire : assez fidèle pour vérifier ce que le pont crée, à qui il l'ouvre,
 * et ce qu'il supprime — sans réseau ni token.
 */
export class FakeDiscordGateway implements DiscordGateway {
  readonly guildId = 'guild-1';
  readonly guildName = 'HackaMetz (test)';
  readonly channels = new Map<string, FakeChannel>();
  readonly roles = new Map<string, string>();
  /** userId → rôles */
  readonly members = new Map<string, Set<string>>();
  /** Historique à renvoyer pour un salon, pour tester l'archivage. */
  readonly history = new Map<string, GatewayMessage[]>();
  handler: CommandHandler | null = null;
  stopped = false;
  private counter = 0;

  private nextId(prefix: string) {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  async createCategory(name: string) {
    const id = this.nextId('cat');
    this.channels.set(id, {
      id,
      name,
      type: 'category',
      parentId: null,
      access: null,
      messages: [],
    });
    return id;
  }
  async createTextChannel(name: string, parentId: string, access: ChannelAccess) {
    const id = this.nextId('text');
    this.channels.set(id, { id, name, type: 'text', parentId, access, messages: [] });
    return id;
  }
  async createVoiceChannel(name: string, parentId: string, access: ChannelAccess) {
    const id = this.nextId('voice');
    this.channels.set(id, { id, name, type: 'voice', parentId, access, messages: [] });
    return id;
  }
  async createRole(name: string) {
    const id = this.nextId('role');
    this.roles.set(id, name);
    return id;
  }
  async deleteChannel(id: string) {
    this.channels.delete(id);
  }
  async deleteRole(id: string) {
    this.roles.delete(id);
    for (const roles of this.members.values()) roles.delete(id);
  }
  async channelExists(id: string) {
    return this.channels.has(id);
  }
  async addRole(userId: string, roleId: string) {
    if (!this.roles.has(roleId)) throw new Error(`rôle inconnu ${roleId}`);
    const roles = this.members.get(userId) ?? new Set<string>();
    roles.add(roleId);
    this.members.set(userId, roles);
  }
  async removeRole(userId: string, roleId: string) {
    this.members.get(userId)?.delete(roleId);
  }
  async sendMessage(channelId: string, content: string, options?: { pin?: boolean }) {
    this.channels.get(channelId)?.messages.push({ content, pinned: Boolean(options?.pin) });
  }
  async *fetchMessages(channelId: string): AsyncIterable<GatewayMessage> {
    for (const message of this.history.get(channelId) ?? []) yield message;
  }
  channelUrl(channelId: string) {
    return `https://discord.com/channels/${this.guildId}/${channelId}`;
  }
  async registerCommands(handler: CommandHandler) {
    this.handler = handler;
  }
  async stop() {
    this.stopped = true;
  }

  // --- Aides pour les assertions
  byType(type: FakeChannel['type']) {
    return [...this.channels.values()].filter((c) => c.type === type);
  }
  rolesOf(userId: string) {
    return [...(this.members.get(userId) ?? [])].map((id) => this.roles.get(id));
  }
}
