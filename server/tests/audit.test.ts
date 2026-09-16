import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const admin = { 'X-Admin-Key': ADMIN_KEY };

interface Entry {
  label: string;
  method: string;
  path: string;
  actorPseudo: string | null;
}

describe('Journal des actions d’organisateur', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('trace les actions admin, ignore les lectures et les échecs', async () => {
    const created = await request(env.app)
      .post('/api/hackathons')
      .set(admin)
      .send(hackathonInput());
    const slug = created.body.hackathon.slug as string;
    await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set(admin)
      .send({ status: 'published' });

    // Lecture : pas de trace.
    await request(env.app).get(`/api/hackathons/${slug}`).set(admin);
    // Action d'un participant sans clé admin : pas de trace non plus.
    const token = (await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' })).body
      .token as string;
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });
    // Échec : transition impossible, rien n'a changé.
    const refused = await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set(admin)
      .send({ status: 'archived' });
    expect(refused.status).toBeGreaterThanOrEqual(400);

    const journal = await request(env.app).get('/api/admin/audit').set(admin);
    expect(journal.status).toBe(200);
    const entries = journal.body.entries as Entry[];
    expect(entries.map((e) => e.label)).toEqual([
      'Changement de statut',
      'Création d’un hackathon',
    ]);
    expect(entries.every((e) => e.method === 'POST')).toBe(true);
    expect(journal.body.total).toBe(2);
  });

  it('retient le pseudo de l’organisateur quand il est aussi identifié', async () => {
    const token = (await request(env.app).post('/api/auth/enter').send({ pseudo: 'simon' })).body
      .token as string;
    await request(env.app)
      .post('/api/hackathons')
      .set(admin)
      .set('Authorization', `Bearer ${token}`)
      .send(hackathonInput({ title: 'Édition signée' }));

    const journal = await request(env.app).get('/api/admin/audit').set(admin);
    expect((journal.body.entries as Entry[])[0]?.actorPseudo).toBe('simon');
  });

  it('reste fermé sans la clé', async () => {
    const anonymous = await request(env.app).get('/api/admin/audit');
    expect(anonymous.status).toBe(403);
  });
});
