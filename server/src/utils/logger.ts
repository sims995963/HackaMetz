import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pino from 'pino';
import { env, isProduction, isTest } from '../config/env';
import { projectRoot } from '../config/paths';

/**
 * Jamais dans les journaux : la clé d'organisateur et les jetons d'appareil.
 * Un fichier de log se partage, se copie, se colle dans une conversation — pas les secrets.
 */
export const REDACTED_PATHS = [
  'req.headers["x-admin-key"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

/**
 * Lancé en service (tâche planifiée Windows, systemd), le serveur n'a pas de console :
 * LOG_FILE donne un fichier à relire quand quelque chose s'est mal passé pendant l'événement.
 */
function destination() {
  if (!env.LOG_FILE) return undefined;
  const path = resolve(projectRoot, env.LOG_FILE);
  mkdirSync(dirname(path), { recursive: true });
  return pino.destination({ dest: path, mkdir: true, sync: false });
}

export const logger = pino(
  {
    level: isTest ? 'silent' : env.LOG_LEVEL,
    redact: { paths: REDACTED_PATHS, censor: '[masqué]' },
    transport:
      isProduction || env.LOG_FILE
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
  },
  destination(),
);
