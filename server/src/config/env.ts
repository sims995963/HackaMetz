import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';
import { PSEUDO_POLICIES } from '@hackametz/shared';
import { projectRoot, serverRoot } from './paths';

// Un .env dans server/ prime sur celui de la racine ; aucun des deux n'est obligatoire.
dotenv.config({ path: resolve(serverRoot, '.env') });
dotenv.config({ path: resolve(projectRoot, '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.string().default('info'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_KEY: z
    .string()
    .min(8, 'ADMIN_KEY : 8 caractères minimum')
    .default('change-moi-avant-le-premier-hackathon'),
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
