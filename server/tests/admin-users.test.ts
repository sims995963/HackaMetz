import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const admin = { 'X-Admin-Key': ADMIN_KEY };

interface AdminUser {
  id: string;
  pseudo: string;
  devices: number;
  registrations: number;
}

describe('Pseudos vus par l’organisateur', () => {
  let env: TestEnv;
  beforeEach(async () => {
    // Politique par défaut : un pseudo est lié à l'appareil qui l'a utilisé.
    env = await createTestEnv('device-bound');
  });
  afterEach(() => env.cleanup());

  it('compte les appareils et les inscriptions, et libère un pseudo bloqué', async () => {
    const entered = await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' });
    const token = entered.body.token as string;

    const created = await request(env.app)
      .post('/api/hackathons')
      .set(admin)
      .send(hackathonInput());
    const slug = created.body.hackathon.slug as string;
    await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set(admin)
      .send({ status: 'published' });
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });

    const listed = await request(env.app).get('/api/admin/users').set(admin);
    expect(listed.status).toBe(200);
    const alice = (listed.body.users as AdminUser[]).find((u) => u.pseudo === 'alice')!;
    expect(alice).toMatchObject({ devices: 1, registrations: 1 });

    // Un autre appareil est refusé tant que le pseudo n'est pas libéré…
    const otherDevice = await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' });
    expect(otherDevice.status).toBe(409);

    const released = await request(env.app).post(`/api/admin/users/${alice.id}/release`).set(admin);
    expect(released.status).toBe(200);

    // …et accepté ensuite.
    const retry = await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' });
    expect(retry.status).toBe(200);
    expect(retry.body.token).toBeTypeOf('string');

    const after = await request(env.app).get('/api/admin/users').set(admin);
    expect((after.body.users as AdminUser[]).find((u) => u.pseudo === 'alice')?.devices).toBe(1);
  });

  it('reste fermé sans la clé', async () => {
    const anonymous = await request(env.app).get('/api/admin/users');
    expect(anonymous.status).toBe(403);
  });
});
