import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };

/** Une clé AWS en dur : exactement ce que le scan doit repérer. */
const withSecret = zipSync({
  'p/README.md': strToU8('# projet'),
  'p/config.js': strToU8("const AWS_SECRET = 'AKIAIOSFODNN7EXAMPLE';\n"),
});

async function setup(env: TestEnv, rejectSecrets: boolean) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        submission: { rejectSecrets },
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(1), endsAt: iso(2) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  const token = (await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' })).body
    .token as string;
  await request(env.app)
    .post(`/api/hackathons/${slug}/registration`)
    .set('Authorization', `Bearer ${token}`)
    .send({ acceptRules: true });
  return { slug, token };
}

const submit = (env: TestEnv, slug: string, token: string) =>
  request(env.app)
    .post(`/api/hackathons/${slug}/submissions`)
    .set('Authorization', `Bearer ${token}`)
    .field('meta', JSON.stringify({ title: 'Projet bavard', consentPublish: true }))
    .attach('archive', Buffer.from(withSecret), 'p.zip');

describe('Scan de secrets au dépôt', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('avertit sans bloquer quand le mode strict est désactivé', async () => {
    const { slug, token } = await setup(env, false);
    const res = await submit(env, slug, token);
    expect(res.status).toBe(201);
    expect(res.body.submission.files.warnings.length).toBeGreaterThan(0);
    expect(res.body.submission.files.warnings[0]).toContain('config.js');
  });

  it('refuse le dépôt en mode strict, en nommant les fichiers, sans rien laisser sur le disque', async () => {
    const { slug, token } = await setup(env, true);
    const res = await submit(env, slug, token);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('secrets');
    expect(res.body.error.details[0].path).toContain('config.js');

    // Aucun projet enregistré, et pas de dossier fantôme dans le stockage.
    const list = await request(env.app).get(`/api/hackathons/${slug}/submissions`);
    expect(list.body.submissions).toHaveLength(0);
    const hackathons = await readdir(join(env.root, 'storage', 'hackathons'));
    const projects = await readdir(
      join(env.root, 'storage', 'hackathons', hackathons[0]!, 'projects'),
    ).catch(() => []);
    for (const project of projects) {
      const inside = await readdir(
        join(env.root, 'storage', 'hackathons', hackathons[0]!, 'projects', project),
      );
      expect(inside).not.toContain('source');
    }
  });
});
