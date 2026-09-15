import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Hackathon en cours avec 2 critères, deux projets déposés par alice et bob. */
async function setup(env: TestEnv) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set(admin)
    .send(
      hackathonInput({
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
        criteria: [
          { label: 'Impact', weight: 2, maxScore: 10 },
          { label: 'Technique', weight: 1, maxScore: 5 },
        ],
        prizes: [{ rank: 1, label: 'Grand prix' }],
      }),
    );
  const slug = created.body.hackathon.slug as string;
  const criteria = created.body.hackathon.criteria as { id: string; label: string }[];
  for (const status of ['published', 'running']) {
    await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
  }
  const submissions: Record<string, string> = {};
  for (const pseudo of ['alice', 'bob']) {
    const token = await enter(env, pseudo);
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });
    const res = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify({ title: `Projet de ${pseudo}`, consentPublish: true }))
      .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8(`# ${pseudo}`) })), 'p.zip');
    submissions[pseudo] = res.body.submission.id;
  }
  return { slug, criteria, submissions };
}

describe('Jury et notation', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('jury par pseudos, notes bornées, classement pondéré, publication', async () => {
    const { slug, criteria, submissions } = await setup(env);
    const [impact, technique] = criteria.map((c) => c.id) as [string, string];
    const marie = await enter(env, 'marie');
    const paul = await enter(env, 'paul');

    const unknown = await request(env.app)
      .put(`/api/hackathons/${slug}/jury`)
      .set(admin)
      .send({ pseudos: ['marie', 'fantome'] });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details[0].message).toContain('fantome');

    const jury = await request(env.app)
      .put(`/api/hackathons/${slug}/jury`)
      .set(admin)
      .send({ pseudos: ['marie', 'Paul'] });
    expect(jury.status).toBe(200);
    expect(jury.body.jury.map((j: { pseudo: string }) => j.pseudo)).toEqual(['marie', 'paul']);

    const intruder = await request(env.app)
      .put(`/api/submissions/${submissions.alice}/evaluation`)
      .set('Authorization', `Bearer ${await enter(env, 'zoe')}`)
      .send({ scores: { [impact]: 5, [technique]: 3 } });
    expect(intruder.status).toBe(403);

    const outOfRange = await request(env.app)
      .put(`/api/submissions/${submissions.alice}/evaluation`)
      .set('Authorization', `Bearer ${marie}`)
      .send({ scores: { [impact]: 12, [technique]: 3 } });
    expect(outOfRange.status).toBe(400);
    expect(outOfRange.body.error.details[0].path).toBe(`scores.${impact}`);

    // marie : alice 10/10 & 5/5 → 100 ; bob 5/10 & 5/5 → (0.5×2 + 1×1)/3 = 66.7
    // paul  : alice 8/10 & 4/5 → (0.8×2 + 0.8×1)/3 = 80 ; bob non noté
    const grade = (token: string, id: string, scores: Record<string, number>, comment = '') =>
      request(env.app)
        .put(`/api/submissions/${id}/evaluation`)
        .set('Authorization', `Bearer ${token}`)
        .send({ scores, comment });
    expect(
      (await grade(marie, submissions.alice!, { [impact]: 10, [technique]: 5 }, 'Bravo')).status,
    ).toBe(200);
    expect((await grade(marie, submissions.bob!, { [impact]: 5, [technique]: 5 })).status).toBe(
      200,
    );
    expect((await grade(paul, submissions.alice!, { [impact]: 8, [technique]: 4 })).status).toBe(
      200,
    );
    // Re-noter remplace la note
    const again = await grade(paul, submissions.alice!, { [impact]: 8, [technique]: 4 }, 'Solide');
    expect(again.status).toBe(200);
    const mine = await request(env.app)
      .get(`/api/hackathons/${slug}/evaluations/mine`)
      .set('Authorization', `Bearer ${paul}`);
    expect(mine.body.evaluations).toHaveLength(1);
    expect(mine.body.evaluations[0].comment).toBe('Solide');

    // Pas encore publié : le public ne voit rien, l'admin voit le provisoire
    const hidden = await request(env.app).get(`/api/hackathons/${slug}/results`);
    expect(hidden.body.published).toBe(false);
    expect(hidden.body.entries).toHaveLength(0);
    const provisional = await request(env.app).get(`/api/hackathons/${slug}/results`).set(admin);
    expect(provisional.body.entries[0].title).toBe('Projet de alice');
    expect(provisional.body.entries[0].score).toBe(90);
    expect(provisional.body.entries[0].comments).toHaveLength(0);

    for (const status of ['submissions_closed', 'judging', 'finished']) {
      await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
    }
    const closed = await grade(marie, submissions.bob!, { [impact]: 9, [technique]: 5 });
    expect(closed.status).toBe(409);

    const results = await request(env.app).get(`/api/hackathons/${slug}/results`);
    expect(results.body.published).toBe(true);
    expect(results.body.juryCount).toBe(2);
    const [first, second] = results.body.entries;
    expect(first.rank).toBe(1);
    expect(first.score).toBe(90);
    expect(first.prize).toBe('Grand prix');
    expect(first.evaluationCount).toBe(2);
    expect(first.byCriterion[impact]).toBe(9);
    expect(first.comments.map((c: { juryPseudo: string }) => c.juryPseudo).sort()).toEqual([
      'marie',
      'paul',
    ]);
    expect(second.rank).toBe(2);
    expect(second.score).toBe(66.7);
    expect(second.prize).toBeNull();
  });

  it('un projet disqualifié sort du classement', async () => {
    const { slug, criteria, submissions } = await setup(env);
    const [impact, technique] = criteria.map((c) => c.id) as [string, string];
    const marie = await enter(env, 'marie');
    await request(env.app)
      .put(`/api/hackathons/${slug}/jury`)
      .set(admin)
      .send({ pseudos: ['marie'] });
    await request(env.app)
      .put(`/api/submissions/${submissions.alice}/evaluation`)
      .set('Authorization', `Bearer ${marie}`)
      .send({ scores: { [impact]: 10, [technique]: 5 } });
    await request(env.app)
      .put(`/api/submissions/${submissions.bob}/evaluation`)
      .set('Authorization', `Bearer ${marie}`)
      .send({ scores: { [impact]: 10, [technique]: 5 } });

    const dq = await request(env.app)
      .post(`/api/submissions/${submissions.alice}/status`)
      .set(admin)
      .send({ status: 'disqualified' });
    expect(dq.status).toBe(200);
    const results = await request(env.app).get(`/api/hackathons/${slug}/results`).set(admin);
    expect(results.body.entries[0].title).toBe('Projet de bob');
    expect(results.body.entries[0].rank).toBe(1);
    expect(results.body.entries[1].status).toBe('disqualified');
    expect(results.body.entries[1].prize).toBeNull();
  });
});

describe('Base de connaissance', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('galerie filtrable et export Git', async () => {
    const { slug, criteria, submissions } = await setup(env);
    const [impact, technique] = criteria.map((c) => c.id) as [string, string];
    const marie = await enter(env, 'marie');
    await request(env.app)
      .put(`/api/hackathons/${slug}/jury`)
      .set(admin)
      .send({ pseudos: ['marie'] });
    await request(env.app)
      .put(`/api/submissions/${submissions.bob}/evaluation`)
      .set('Authorization', `Bearer ${marie}`)
      .send({ scores: { [impact]: 10, [technique]: 5 } });
    for (const status of ['submissions_closed', 'judging', 'finished']) {
      await request(env.app).post(`/api/hackathons/${slug}/status`).set(admin).send({ status });
    }

    const all = await request(env.app).get('/api/kb/projects');
    expect(all.body.projects).toHaveLength(2);
    expect(all.body.technologies).toContain('Markdown');
    const bob = all.body.projects.find((p: { ownerPseudo: string }) => p.ownerPseudo === 'bob');
    expect(bob.rank).toBe(1);
    const search = await request(env.app).get('/api/kb/projects').query({ q: 'de alice' });
    expect(search.body.projects.map((p: { title: string }) => p.title)).toEqual([
      'Projet de alice',
    ]);
    const byTech = await request(env.app).get('/api/kb/projects').query({ tech: 'python' });
    expect(byTech.body.projects).toHaveLength(0);

    const forbidden = await request(env.app).post('/api/admin/kb/export').send({ commit: true });
    expect(forbidden.status).toBe(403);

    const exported = await request(env.app)
      .post('/api/admin/kb/export')
      .set(admin)
      .send({ commit: true });
    expect(exported.status).toBe(200);
    expect(exported.body.hackathons).toBe(1);
    expect(exported.body.projects).toBe(2);
    expect(exported.body.committed).toBe(true);
    expect(exported.body.commitMessage).toContain('1 hackathon, 2 projets');

    const storage = join(env.root, 'storage');
    expect(existsSync(join(storage, '.git'))).toBe(true);
    expect(existsSync(join(storage, '.gitignore'))).toBe(true);
    const root = readFileSync(join(storage, 'README.md'), 'utf8');
    expect(root).toContain("| 001 | [IA pour l'éducation](hackathons/001-ia-pour-l-education/)");
    expect(root).toContain('Projet de bob (bob)');
    const readme = readFileSync(
      join(storage, 'hackathons', '001-ia-pour-l-education', 'README.md'),
      'utf8',
    );
    expect(readme).toContain('## Classement');
    expect(readme).toContain('| 1 | Projet de bob | bob | 100 | Grand prix |');

    const nothing = await request(env.app)
      .post('/api/admin/kb/export')
      .set(admin)
      .send({ commit: true });
    expect(nothing.body.committed).toBe(false);
    expect(nothing.body.gitError).toContain('Rien à committer');
  });
});
