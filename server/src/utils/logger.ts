import pino from 'pino';
import { env, isProduction, isTest } from '../config/env';

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

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[masqué]' },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});
