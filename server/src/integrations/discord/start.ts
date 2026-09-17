import type { AppContext } from '../../context';
import { logger } from '../../utils/logger';
import { NOOP_HOOKS } from '../hooks';
import { DiscordBridge } from './discord.bridge';
import { connectDiscord } from './discordjs.gateway';

export interface DiscordStartOptions {
  token: string;
  guildId: string;
  inviteUrl: string | null;
  graceHours: number;
}

/**
 * Connecte le bot, branche le pont sur les hooks du contexte, enregistre les commandes.
 * Rend une fonction d'arrêt. Une connexion qui échoue laisse le serveur tourner sans Discord :
 * l'erreur est journalisée et visible dans le tableau de bord.
 */
export async function startDiscordBridge(
  ctx: AppContext,
  options: DiscordStartOptions,
): Promise<() => Promise<void>> {
  let gateway;
  try {
    gateway = await connectDiscord(options.token, options.guildId);
  } catch (err) {
    logger.error({ err }, 'Discord : connexion impossible — le serveur continue sans le pont');
    ctx.hooks.attach({
      ...NOOP_HOOKS,
      status: () => ({
        state: 'error',
        guildName: null,
        openSpaces: 0,
        error: err instanceof Error ? err.message : String(err),
      }),
    });
    return async () => undefined;
  }

  const bridge = new DiscordBridge(ctx.repos, ctx.storage, gateway, {
    inviteUrl: options.inviteUrl,
    graceHours: options.graceHours,
  });
  await bridge.start();
  ctx.hooks.attach(bridge);
  logger.info({ guild: gateway.guildName }, 'Pont Discord connecté');

  // Rattrapage immédiat : éditions publiées et équipes créées pendant que le bot était éteint.
  await bridge
    .tick()
    .catch((err) => logger.error({ err }, 'Discord : rattrapage initial en échec'));

  return async () => {
    ctx.hooks.detach();
    await gateway.stop();
  };
}
