import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function setup(env: TestEnv) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
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
    .set(bearer(token))
    .send({ acceptRules: true });
  await request(env.app)
    .post(`/api/hackathons/${slug}/submissions`)
    .set(bearer(token))
    // Une virgule et un guillemet dans le titre : le CSV doit rester lisible.
    .field(
      'meta',
      JSON.stringify({ title: 'Ville, « propre »', techStack: ['vue'], consentPublish: true }),
    )
    .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
  return { slug, token };
}

describe('Exports CSV', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('réservés à l’organisateur, échappés, nommés d’après l’édition', async () => {
    const { slug, token } = await setup(env);

    const anonymous = await request(env.app).get(
      `/api/hackathons/${slug}/exports/participants.csv`,
    );
    expect(anonymous.status).toBe(403);
    const asUser = await request(env.app)
      .get(`/api/hackathons/${slug}/exports/participants.csv`)
      .set(bearer(token));
    expect(asUser.status).toBe(403);

    const participants = await request(env.app)
      .get(`/api/hackathons/${slug}/exports/participants.csv`)
      .set(admin);
    expect(participants.status).toBe(200);
    expect(participants.headers['content-type']).toContain('text/csv');
    expect(participants.headers['content-disposition']).toContain(`001-${slug}-participants.csv`);
    const lines = participants.text.trim().split('\r\n');
    expect(lines[0]).toContain('pseudo,equipe,inscrit_le');
    expect(lines[1]).toMatch(/^alice,,/);

    const projects = await request(env.app)
      .get(`/api/hackathons/${slug}/exports/projets.csv`)
      .set(admin);
    expect(projects.text).toContain('"Ville, « propre »"');
    expect(projects.text).toContain('01,');

    const results = await request(env.app)
      .get(`/api/hackathons/${slug}/exports/resultats.csv`)
      .set(admin);
    expect(results.text.split('\r\n')[0]).toContain('rang,projet,auteur');

    const unknown = await request(env.app)
      .get(`/api/hackathons/${slug}/exports/wat.csv`)
      .set(admin);
    expect(unknown.status).toBe(400);
  });
});
