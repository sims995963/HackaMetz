import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PSEUDO_POLICIES } from '@hackametz/shared';
import { projectRoot, serverRoot } from './paths';

// Un .env dans server/ prime sur celui de la racine ; aucun des deux n'est obligatoire.
dotenv.config({ path: resolve(serverRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env') });

/** Clé de repli, acceptée uniquement en test : hors test, le serveur refuse de démarrer sans clé. */
const TEST_ADMIN_KEY = 'cle-admin-de-test';
/** Valeurs qui traînaient dans la documentation : les refuser évite un serveur ouvert à tous. */
const FORBIDDEN_ADMIN_KEYS = new Set([
  'change-moi-avant-le-premier-hackathon',
  'change-me',
  'admin',
  'password',
]);
const MIN_ADMIN_KEY_LENGTH = 24;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default('info'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_KEY: z
    .string()
    .min(8, 'ADMIN_KEY manquante ou trop courte — génère-la avec : npm run admin-key')
    .default(TEST_ADMIN_KEY),
  PSEUDO_POLICY: z.enum(PSEUDO_POLICIES).default('device-bound'),
  DATA_PATH: z.string().default('server/data'),
  STORAGE_PATH: z.string().default('server/storage'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Configuration invalide :\n${lines.join('\n')}`);
}

export const env = parsed.data;

/** Chemins absolus, résolus depuis la racine du projet. */
export const paths = {
  dataDir: resolve(projectRoot, env.DATA_PATH),
  storageDir: resolve(projectRoot, env.STORAGE_PATH),
};

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Une clé d'organisateur faible, c'est un hackathon où n'importe qui publie et disqualifie.
if (!isTest) {
  if (FORBIDDEN_ADMIN_KEYS.has(env.ADMIN_KEY) || env.ADMIN_KEY === TEST_ADMIN_KEY) {
    throw new Error('ADMIN_KEY est une valeur d’exemple. Génère une vraie clé : npm run admin-key');
  }
  if (env.ADMIN_KEY.length < MIN_ADMIN_KEY_LENGTH) {
    console.warn(
      `⚠  ADMIN_KEY fait ${env.ADMIN_KEY.length} caractères ; ${MIN_ADMIN_KEY_LENGTH} minimum recommandés (npm run admin-key).`,
    );
  }
}
