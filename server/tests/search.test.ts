import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

interface Result {
  type: string;
  title: string;
  to: string;
}

async function setup(env: TestEnv) {
  const published = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        title: 'Écologie urbaine',
        theme: 'Rendre la ville respirable',
        tags: ['mobilité', 'open-data'],
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
      }),
    );
  const slug = published.body.hackathon.slug as string;
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  // Un brouillon, invisible sans la clé d'organisateur.
  await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(hackathonInput({ title: 'Écologie secrète' }));

  const token = (await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' })).body
    .token as string;
  await request(env.app)
    .post(`/api/hackathons/${slug}/registration`)
    .set(bearer(token))
    .send({ acceptRules: true });
  await request(env.app)
    .post(`/api/hackathons/${slug}/submissions`)
    .set(bearer(token))
    .field(
      'meta',
      JSON.stringify({
        title: 'Capteurs citoyens',
        pitch: 'Mesurer la qualité de l’air avec des capteurs bon marché',
        techStack: ['python', 'mqtt'],
        consentPublish: true,
      }),
    )
    .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
  return { slug, token };
}

const search = (env: TestEnv, q: string, asAdmin = false) => {
  const req = request(env.app).get(`/api/search?q=${encodeURIComponent(q)}`);
  return asAdmin ? req.set(admin) : req;
};

describe('Recherche globale', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('trouve éditions, projets, technos et pseudos, sans accents', async () => {
    const { slug } = await setup(env);

    const edition = await search(env, 'ecologie');
    const titles = (edition.body.results as Result[]).map((r) => r.title);
    expect(titles).toContain('Écologie urbaine');
    expect(titles).not.toContain('Écologie secrète'); // brouillon

    const project = await search(env, 'capteurs');
    const first = (project.body.results as Result[])[0]!;
    expect(first).toMatchObject({ type: 'project', title: 'Capteurs citoyens' });
    expect(first.to).toBe(`/hackathons/${slug}/projects/${first.to.split('/').pop()}`);

    // Le pitch compte aussi, avec un score plus faible que le titre.
    const byPitch = await search(env, 'qualité de l’air');
    expect((byPitch.body.results as Result[]).some((r) => r.title === 'Capteurs citoyens')).toBe(
      true,
    );

    const tech = await search(env, 'mqtt');
    expect((tech.body.results as Result[]).some((r) => r.type === 'tech' && r.title === 'mqtt')).toBe(
      true,
    );

    const person = await search(env, 'alice');
    expect((person.body.results as Result[]).some((r) => r.type === 'person')).toBe(true);
  });

  it('renvoie les brouillons à l’organisateur et rien pour une requête vide', async () => {
    await setup(env);
    const asAdmin = await search(env, 'ecologie', true);
    expect((asAdmin.body.results as Result[]).map((r) => r.title)).toContain('Écologie secrète');

    const empty = await search(env, '   ');
    expect(empty.body).toEqual({ query: '', results: [] });
  });
});
