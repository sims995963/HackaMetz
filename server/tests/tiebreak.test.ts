import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Deux projets notés exactement pareil, avec un vote du public en faveur du second. */
async function setup(env: TestEnv, tieBreak: { mode: string; criterionId?: string | null }) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        publicVote: true,
        tieBreak,
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(1), endsAt: iso(2) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  const criteria = created.body.hackathon.criteria as { id: string; maxScore: number }[];
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }

  const tokens: Record<string, string> = {};
  const submissions: Record<string, string> = {};
  for (const pseudo of ['alice', 'bob', 'chloe', 'marie']) {
    tokens[pseudo] = (await request(env.app).post('/api/auth/enter').send({ pseudo })).body
      .token as string;
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set(bearer(tokens[pseudo]!))
      .send({ acceptRules: true });
  }
  for (const pseudo of ['alice', 'bob']) {
    const res = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set(bearer(tokens[pseudo]!))
      .field('meta', JSON.stringify({ title: `Projet ${pseudo}`, consentPublish: true }))
      .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
    submissions[pseudo] = res.body.submission.id as string;
  }

  // Chloe vote pour le projet de bob : c'est le seul écart entre les deux.
  await request(env.app)
    .put(`/api/hackathons/${slug}/vote`)
    .set(bearer(tokens.chloe!))
    .send({ submissionId: submissions.bob });

  await request(env.app)
    .put(`/api/hackathons/${slug}/jury`)
    .set(admin)
    .send({ pseudos: ['marie'] });
  for (const pseudo of ['alice', 'bob']) {
    await request(env.app)
      .put(`/api/submissions/${submissions[pseudo]}/evaluation`)
      .set(bearer(tokens.marie!))
      .send({
        scores: Object.fromEntries(criteria.map((c) => [c.id, c.maxScore - 2])),
        comment: '',
      });
  }
  for (const status of ['submissions_closed', 'judging', 'finished']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  return { slug, submissions };
}

interface Row {
  rank: number;
  title: string;
  score: number | null;
  publicVotes: number;
}

describe('Départage des ex æquo', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('le vote du public tranche quand les scores sont identiques', async () => {
    const { slug } = await setup(env, { mode: 'publicVote' });
    const results = await request(env.app).get(`/api/hackathons/${slug}/results`);
    const rows = results.body.entries as Row[];
    expect(rows[0]).toMatchObject({ title: 'Projet bob', rank: 1, publicVotes: 1 });
    expect(rows[1]).toMatchObject({ title: 'Projet alice', rank: 2 });
    expect(rows[0]!.score).toBe(rows[1]!.score);
  });

  it('« aucun départage » laisse les deux au même rang', async () => {
    const { slug } = await setup(env, { mode: 'none' });
    const rows = (await request(env.app).get(`/api/hackathons/${slug}/results`)).body
      .entries as Row[];
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('le dépôt le plus ancien peut servir de départage', async () => {
    const { slug } = await setup(env, { mode: 'submittedAt' });
    const rows = (await request(env.app).get(`/api/hackathons/${slug}/results`)).body
      .entries as Row[];
    // alice a déposé en premier dans le scénario.
    expect(rows[0]).toMatchObject({ title: 'Projet alice', rank: 1 });
    expect(rows[1]).toMatchObject({ title: 'Projet bob', rank: 2 });
  });
});
