import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const admin = { 'X-Admin-Key': ADMIN_KEY };

const roundInput = {
  title: 'Thème du printemps',
  description: 'Trois idées, une seule sera retenue.',
  proposals: [
    { title: 'Ville durable', theme: 'Mobilité et énergie', tags: ['écologie'] },
    { title: 'Santé & bien-être', theme: 'Prévention au quotidien' },
    { title: 'Jeu vidéo en 48h', theme: 'Game jam', coverColor: '#EA580C' },
  ],
};

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

describe('Propositions de hackathons', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('trois propositions, un vote par pseudo, la plus votée gagne et devient un hackathon', async () => {
    const forbidden = await request(env.app).post('/api/proposals').send(roundInput);
    expect(forbidden.status).toBe(403);

    const twoOnly = await request(env.app)
      .post('/api/proposals')
      .set(admin)
      .send({ ...roundInput, proposals: roundInput.proposals.slice(0, 2) });
    expect(twoOnly.status).toBe(400);

    const created = await request(env.app).post('/api/proposals').set(admin).send(roundInput);
    expect(created.status).toBe(201);
    const round = created.body.round;
    expect(round.number).toBe(1);
    expect(round.status).toBe('draft');
    expect(round.proposals).toHaveLength(3);
    const [ville, sante, jeu] = round.proposals.map((p: { id: string }) => p.id) as [
      string,
      string,
      string,
    ];

    // Brouillon invisible au public
    const publicList = await request(env.app).get('/api/proposals');
    expect(publicList.body.rounds).toHaveLength(0);

    const tooEarly = await request(env.app)
      .put(`/api/proposals/${round.id}/vote`)
      .set('Authorization', `Bearer ${await enter(env, 'alice')}`)
      .send({ proposalId: ville });
    expect(tooEarly.status).toBe(409);

    const opened = await request(env.app)
      .post(`/api/proposals/${round.id}/status`)
      .set(admin)
      .send({ status: 'open' });
    expect(opened.body.round.status).toBe('open');

    const locked = await request(env.app)
      .patch(`/api/proposals/${round.id}`)
      .set(admin)
      .send(roundInput);
    expect(locked.status).toBe(409);

    const tokens = {
      alice: await enter(env, 'alice'),
      bob: await enter(env, 'bob'),
      chloe: await enter(env, 'chloe'),
    };
    const vote = (token: string, proposalId: string) =>
      request(env.app)
        .put(`/api/proposals/${round.id}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ proposalId });

    expect((await vote(tokens.alice, ville)).status).toBe(200);
    expect((await vote(tokens.bob, ville)).status).toBe(200);
    const chloeFirst = await vote(tokens.chloe, sante);
    expect(chloeFirst.body.round.counts).toEqual({ [ville]: 2, [sante]: 1, [jeu]: 0 });
    expect(chloeFirst.body.round.mine).toBe(sante);

    // chloe change d'avis : toujours un seul vote
    const chloeSecond = await vote(tokens.chloe, jeu);
    expect(chloeSecond.body.round.counts).toEqual({ [ville]: 2, [sante]: 0, [jeu]: 1 });
    expect(chloeSecond.body.round.totalVotes).toBe(3);

    const unknown = await vote(tokens.alice, 'nope');
    expect(unknown.status).toBe(404);

    const second = await request(env.app)
      .post('/api/proposals')
      .set(admin)
      .send({ ...roundInput, title: 'Tour 2' });
    const cannotOpenTwo = await request(env.app)
      .post(`/api/proposals/${second.body.round.id}/status`)
      .set(admin)
      .send({ status: 'open' });
    expect(cannotOpenTwo.status).toBe(409);

    const closed = await request(env.app)
      .post(`/api/proposals/${round.id}/status`)
      .set(admin)
      .send({ status: 'closed' });
    expect(closed.body.round.status).toBe('closed');
    expect(closed.body.round.winnerProposalId).toBe(ville);

    const afterClose = await vote(tokens.alice, sante);
    expect(afterClose.status).toBe(409);

    // Le hackathon créé à partir du gagnant est lié au tour
    const hackathon = await request(env.app)
      .post('/api/hackathons')
      .set(admin)
      .send(
        hackathonInput({
          title: 'Ville durable',
          theme: 'Mobilité et énergie',
          fromRoundId: round.id,
        }),
      );
    expect(hackathon.status).toBe(201);
    const linked = await request(env.app).get(`/api/proposals/${round.id}`);
    expect(linked.body.round.hackathonId).toBe(hackathon.body.hackathon.id);
    expect(hackathon.body.hackathon).not.toHaveProperty('fromRoundId');

    const list = await request(env.app).get('/api/proposals');
    expect(list.body.rounds.map((r: { title: string }) => r.title)).toEqual(['Thème du printemps']);
  });
});
