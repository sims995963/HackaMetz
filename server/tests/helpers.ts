import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PseudoPolicy } from '@hackametz/shared';
import { createApp } from '../src/app';
import { createContext, type AppContext } from '../src/context';

export const ADMIN_KEY = 'cle-admin-de-test';

export interface TestEnv {
  app: ReturnType<typeof createApp>;
  ctx: AppContext;
  root: string;
  cleanup: () => Promise<void>;
}

/** Une app complète sur des dossiers temporaires, jetés à la fin du test. */
export async function createTestEnv(pseudoPolicy: PseudoPolicy = 'device-bound'): Promise<TestEnv> {
  const root = await mkdtemp(join(tmpdir(), 'hackametz-test-'));
  const ctx = createContext({
    dataDir: join(root, 'data'),
    storageDir: join(root, 'storage'),
    adminKey: ADMIN_KEY,
    pseudoPolicy,
  });
  return {
    app: createApp(ctx),
    ctx,
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/** Un hackathon valide minimal pour POST /api/hackathons. */
export function hackathonInput(overrides: Record<string, unknown> = {}) {
  const day = 24 * 60 * 60 * 1000;
  const iso = (offset: number) => new Date(Date.now() + offset * day).toISOString();
  return {
    title: "IA pour l'éducation",
    theme: 'Apprendre autrement',
    dates: { startsAt: iso(1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
    ...overrides,
  };
}
