import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();
const admin = { 'X-Admin-Key': ADMIN_KEY };
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

/** Un hackathon en cours avec alice (inscrite + projet) et bob (inscrit). */
async function setup(env: TestEnv) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        publicVote: true,
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  const criteria = created.body.hackathon.criteria as { id: string; maxScore: number }[];
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  const tokens: Record<string, string> = {};
  for (const pseudo of ['alice', 'bob']) {
    tokens[pseudo] = await enter(env, pseudo);
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set(bearer(tokens[pseudo]))
      .send({ acceptRules: true });
  }
  const sub = await request(env.app)
    .post(`/api/hackathons/${slug}/submissions`)
    .set(bearer(tokens.alice!))
    .field('meta', JSON.stringify({ title: 'Projet d’alice', consentPublish: true }))
    .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
  return { slug, tokens, criteria, submissionId: sub.body.submission.id as string };
}

describe('Questions à l’organisateur', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('poser, soutenir, répondre, retirer', async () => {
    const { slug, tokens } = await setup(env);
    const anonymous = await request(env.app).post(`/api/hackathons/${slug}/questions`).send({
      content: 'Peut-on utiliser une lib externe ?',
    });
    expect(anonymous.status).toBe(401);

    const tooShort = await request(env.app)
      .post(`/api/hackathons/${slug}/questions`)
      .set(bearer(tokens.bob!))
      .send({ content: 'Hé ?' });
    expect(tooShort.status).toBe(400);

    const asked = await request(env.app)
      .post(`/api/hackathons/${slug}/questions`)
      .set(bearer(tokens.bob!))
      .send({ content: 'Peut-on utiliser une lib externe ?' });
    expect(asked.status).toBe(201);
    expect(asked.body.question).toMatchObject({ authorPseudo: 'bob', upvotes: 0, mine: true });
    const id = asked.body.question.id as string;

    const upvoted = await request(env.app)
      .put(`/api/hackathons/${slug}/questions/${id}/upvote`)
      .set(bearer(tokens.alice!));
    expect(upvoted.body.question).toMatchObject({ upvotes: 1, upvoted: true, mine: false });
    // Idempotent : un second +1 ne compte pas double.
    await request(env.app)
      .put(`/api/hackathons/${slug}/questions/${id}/upvote`)
      .set(bearer(tokens.alice!));
    const list = await request(env.app).get(`/api/hackathons/${slug}/questions`);
    expect(list.body.questions[0].upvotes).toBe(1);
    expect(list.body.questions[0].upvoterIds).toBeUndefined();

    const notAdmin = await request(env.app)
      .post(`/api/hackathons/${slug}/questions/${id}/answer`)
      .set(bearer(tokens.alice!))
      .send({ content: 'Oui' });
    expect(notAdmin.status).toBe(403);

    const answered = await request(env.app)
      .post(`/api/hackathons/${slug}/questions/${id}/answer`)
      .set(admin)
      .send({ content: 'Oui, tant que la licence le permet.' });
    expect(answered.status).toBe(200);
    expect(answered.body.question.answer.content).toContain('licence');

    // Répondue : l'auteur ne peut plus la retirer, l'organisateur si.
    const authorRemove = await request(env.app)
      .delete(`/api/hackathons/${slug}/questions/${id}`)
      .set(bearer(tokens.bob!));
    expect(authorRemove.status).toBe(409);
    const adminRemove = await request(env.app)
      .delete(`/api/hackathons/${slug}/questions/${id}`)
      .set(admin)
      .set(bearer(tokens.alice!));
    expect(adminRemove.status).toBe(204);
  });

  it('les questions sans réponse passent en tête, triées par soutien', async () => {
    const { slug, tokens } = await setup(env);
    const ask = (token: string, content: string) =>
      request(env.app)
        .post(`/api/hackathons/${slug}/questions`)
        .set(bearer(token))
        .send({ content });
    const q1 = (await ask(tokens.alice!, 'Première question posée')).body.question.id as string;
    const q2 = (await ask(tokens.bob!, 'Deuxième question posée')).body.question.id as string;
    const q3 = (await ask(tokens.bob!, 'Troisième question posée')).body.question.id as string;
    await request(env.app)
      .put(`/api/hackathons/${slug}/questions/${q1}/upvote`)
      .set(bearer(tokens.bob!));
    await request(env.app)
      .post(`/api/hackathons/${slug}/questions/${q3}/answer`)
      .set(admin)
      .send({ content: 'Réponse' });
    const list = await request(env.app).get(`/api/hackathons/${slug}/questions`);
    expect(list.body.questions.map((q: { id: string }) => q.id)).toEqual([q1, q2, q3]);
  });
});

describe('Retours des participants', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('ouverts après les dépôts, un par inscrit, synthèse anonyme sauf pour l’organisateur', async () => {
    const { slug, tokens } = await setup(env);
    const closedYet = await request(env.app)
      .put(`/api/hackathons/${slug}/feedback`)
      .set(bearer(tokens.bob!))
      .send({ rating: 5 });
    expect(closedYet.status).toBe(409);

    await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set(admin)
      .send({ status: 'submissions_closed' });

    const stranger = await enter(env, 'zoe');
    const notRegistered = await request(env.app)
      .put(`/api/hackathons/${slug}/feedback`)
      .set(bearer(stranger))
      .send({ rating: 4 });
    expect(notRegistered.status).toBe(403);

    const first = await request(env.app)
      .put(`/api/hackathons/${slug}/feedback`)
      .set(bearer(tokens.bob!))
      .send({ rating: 3, liked: 'Les pizzas', improve: 'Le wifi', wouldReturn: false });
    expect(first.status).toBe(200);
    // Modifiable : même auteur → même enregistrement, pas un doublon.
    await request(env.app)
      .put(`/api/hackathons/${slug}/feedback`)
      .set(bearer(tokens.bob!))
      .send({ rating: 5, liked: 'Les pizzas', wouldReturn: true });
    await request(env.app)
      .put(`/api/hackathons/${slug}/feedback`)
      .set(bearer(tokens.alice!))
      .send({ rating: 4, improve: 'Plus de temps' });

    const asBob = await request(env.app)
      .get(`/api/hackathons/${slug}/feedback`)
      .set(bearer(tokens.bob!));
    expect(asBob.body).toMatchObject({
      open: true,
      count: 2,
      participants: 2,
      averageRating: 4.5,
      wouldReturnRate: 100,
    });
    expect(asBob.body.mine.rating).toBe(5);
    expect(asBob.body.comments).toEqual([]);

    const asAdmin = await request(env.app).get(`/api/hackathons/${slug}/feedback`).set(admin);
    expect(asAdmin.body.comments).toHaveLength(2);
    expect(asAdmin.body.comments.map((c: { improve: string }) => c.improve)).toContain(
      'Plus de temps',
    );
  });
});

describe('Profil : résultats et palmarès', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('un podium et un coup de cœur apparaissent une fois l’édition terminée', async () => {
    const { slug, tokens, criteria, submissionId } = await setup(env);
    await request(env.app)
      .put(`/api/hackathons/${slug}/vote`)
      .set(bearer(tokens.bob!))
      .send({ submissionId });
    await request(env.app)
      .post(`/api/hackathons/${slug}/questions`)
      .set(bearer(tokens.alice!))
      .send({ content: 'Y aura-t-il du café ?' });

    const before = await request(env.app).get('/api/me').set(bearer(tokens.alice!));
    expect(before.body.results).toEqual([]);
    expect(before.body.achievements.map((a: { id: string }) => a.id).sort()).toEqual([
      'builder',
      'curious',
      'first_steps',
    ]);

    await request(env.app)
      .put(`/api/hackathons/${slug}/jury`)
      .set(admin)
      .send({ pseudos: ['bob'] });
    await request(env.app)
      .put(`/api/submissions/${submissionId}/evaluation`)
      .set(bearer(tokens.bob!))
      .send({
        scores: Object.fromEntries(criteria.map((c) => [c.id, c.maxScore])),
        comment: '',
      });
    for (const status of ['submissions_closed', 'judging', 'finished']) {
      await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
    }

    const after = await request(env.app).get('/api/me').set(bearer(tokens.alice!));
    expect(after.body.results).toHaveLength(1);
    expect(after.body.results[0]).toMatchObject({
      rank: 1,
      total: 1,
      publicFavorite: true,
      title: 'Projet d’alice',
    });
    const ids = after.body.achievements.map((a: { id: string }) => a.id);
    expect(ids).toContain('podium_1');
    expect(ids).toContain('crowd_favorite');

    const bob = await request(env.app).get('/api/me').set(bearer(tokens.bob!));
    expect(bob.body.achievements.map((a: { id: string }) => a.id)).toContain('juror');
  });
});
