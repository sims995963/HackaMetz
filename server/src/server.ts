import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { createApp } from './app';
import { discordConfig, env, paths } from './config/env';
import { projectRoot } from './config/paths';
import { createContext } from './context';
import { startLifecycleJob } from './jobs/lifecycle.job';
import { logger } from './utils/logger';

/** Adresses IPv4 de la machine sur le réseau local : ce sont elles que les participants ouvrent. */
function lanUrls(port: number): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface !== undefined && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => `http://${iface!.address}:${port}`);
}

const ctx = createContext({
  dataDir: paths.dataDir,
  storageDir: paths.storageDir,
  adminKey: env.ADMIN_KEY,
  pseudoPolicy: env.PSEUDO_POLICY,
});

const app = createApp(ctx);

// Le pont Discord se connecte avant le job de cycle de vie : le premier tick le trouve prêt.
let stopDiscord: () => Promise<void> = async () => undefined;
if (discordConfig) {
  const { startDiscordBridge } = await import('./integrations/discord/start');
  stopDiscord = await startDiscordBridge(ctx, discordConfig);
}

const stopLifecycleJob = startLifecycleJob(ctx);
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      data: paths.dataDir,
      storage: paths.storageDir,
      pseudoPolicy: env.PSEUDO_POLICY,
    },
    `HackaMetz API prête sur http://localhost:${env.PORT}/api`,
  );
  if (existsSync(resolve(projectRoot, 'client/dist'))) {
    const urls = lanUrls(env.PORT);
    logger.info(`Front servi sur http://localhost:${env.PORT}`);
    if (urls.length > 0) logger.info(`À partager sur le réseau local : ${urls.join('  ')}`);
  } else {
    logger.info(
      'Pas de build du front (npm run build) : en dev, ouvre Vite sur http://localhost:5173',
    );
  }
});

// Arrêt propre : on laisse les requêtes en cours se terminer.
function shutdown(signal: string) {
  logger.info({ signal }, 'Arrêt du serveur');
  stopLifecycleJob();
  void stopDiscord().catch(() => undefined);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
