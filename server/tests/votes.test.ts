import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

async function setup(env: TestEnv, publicVote = true) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        publicVote,
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  const tokens: Record<string, string> = {};
  const submissions: Record<string, string> = {};
  for (const pseudo of ['alice', 'bob', 'chloe']) {
    tokens[pseudo] = await enter(env, pseudo);
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${tokens[pseudo]}`)
      .send({ acceptRules: true });
  }
  for (const pseudo of ['alice', 'bob']) {
    const res = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${tokens[pseudo]}`)
      .field('meta', JSON.stringify({ title: `Projet de ${pseudo}`, consentPublish: true }))
      .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
    submissions[pseudo] = res.body.submission.id;
  }
  return { slug, tokens, submissions };
}

describe('Vote du public', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('un vote par inscrit, pas pour soi, modifiable, compté dans les résultats', async () => {
    const { slug, tokens, submissions } = await setup(env);
    const vote = (token: string, submissionId: string) =>
      request(env.app)
        .put(`/api/hackathons/${slug}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ submissionId });

    const anonymous = await request(env.app)
      .put(`/api/hackathons/${slug}/vote`)
      .send({ submissionId: submissions.alice });
    expect(anonymous.status).toBe(401);

    const outsider = await vote(await enter(env, 'zoe'), submissions.alice!);
    expect(outsider.status).toBe(403);

    const self = await vote(tokens.alice!, submissions.alice!);
    expect(self.status).toBe(409);

    expect((await vote(tokens.alice!, submissions.bob!)).status).toBe(200);
    expect((await vote(tokens.chloe!, submissions.bob!)).status).toBe(200);
    const bobVotes = await vote(tokens.bob!, submissions.alice!);
    expect(bobVotes.body.counts).toEqual({ [submissions.bob!]: 2, [submissions.alice!]: 1 });
    expect(bobVotes.body.mine).toBe(submissions.alice);

    // chloe change d'avis : un seul vote par personne
    const changed = await vote(tokens.chloe!, submissions.alice!);
    expect(changed.body.counts).toEqual({ [submissions.bob!]: 1, [submissions.alice!]: 2 });
    expect(changed.body.total).toBe(3);

    const withdrawn = await request(env.app)
      .delete(`/api/hackathons/${slug}/vote`)
      .set('Authorization', `Bearer ${tokens.chloe}`);
    expect(withdrawn.body.mine).toBeNull();
    expect(withdrawn.body.total).toBe(2);

    const summary = await request(env.app).get(`/api/hackathons/${slug}/votes`);
    expect(summary.body.open).toBe(true);
    expect(summary.body.mine).toBeNull();

    const results = await request(env.app).get(`/api/hackathons/${slug}/results`).set(admin);
    expect(results.body.publicFavorite).toEqual({ submissionId: submissions.alice, votes: 1 });
    const aliceEntry = results.body.entries.find(
      (e: { submissionId: string }) => e.submissionId === submissions.alice,
    );
    expect(aliceEntry.publicVotes).toBe(1);

    for (const status of ['submissions_closed', 'judging', 'finished']) {
      await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
    }
    const closed = await vote(tokens.alice!, submissions.bob!);
    expect(closed.status).toBe(409);
    const afterClose = await request(env.app).get(`/api/hackathons/${slug}/votes`);
    expect(afterClose.body.open).toBe(false);
  });

  it('vote désactivé par le hackathon', async () => {
    const { slug, tokens, submissions } = await setup(env, false);
    const res = await request(env.app)
      .put(`/api/hackathons/${slug}/vote`)
      .set('Authorization', `Bearer ${tokens.alice}`)
      .send({ submissionId: submissions.bob });
    expect(res.status).toBe(409);
    const results = await request(env.app).get(`/api/hackathons/${slug}/results`).set(admin);
    expect(results.body.publicFavorite).toBeNull();
  });
});
