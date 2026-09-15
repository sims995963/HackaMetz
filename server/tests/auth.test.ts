import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ADMIN_KEY, createTestEnv, type TestEnv } from './helpers';

describe('Identité par pseudo', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('device-bound');
  });
  afterEach(() => env.cleanup());

  it('crée le pseudo au premier passage et renvoie un token', async () => {
    const res = await request(env.app).post('/api/auth/enter').send({ pseudo: 'Simon' });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.user.pseudo).toBe('Simon');
    expect(res.body.user.pseudoNormalized).toBe('simon');
    expect(res.body.user).not.toHaveProperty('deviceTokenHashes');
    expect(typeof res.body.token).toBe('string');
  });

  it('refuse un pseudo invalide ou réservé', async () => {
    const short = await request(env.app).post('/api/auth/enter').send({ pseudo: 'ab' });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    expect(short.body.error.details[0].path).toBe('pseudo');

    const reserved = await request(env.app).post('/api/auth/enter').send({ pseudo: 'admin' });
    expect(reserved.status).toBe(400);
  });

  it('GET /api/me renvoie l’utilisateur du token, 401 sans token', async () => {
    const enter = await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' });
    const me = await request(env.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${enter.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(enter.body.user.id);

    const anonymous = await request(env.app).get('/api/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('device-bound : un autre appareil ne peut pas reprendre le pseudo (casse ignorée)', async () => {
    const first = await request(env.app).post('/api/auth/enter').send({ pseudo: 'bob' });
    expect(first.status).toBe(201);

    const intruder = await request(env.app).post('/api/auth/enter').send({ pseudo: 'BOB' });
    expect(intruder.status).toBe(409);
    expect(intruder.body.error.code).toBe('PSEUDO_TAKEN');

    // Le même appareil (même token) repasse sans problème
    const again = await request(env.app)
      .post('/api/auth/enter')
      .set('Authorization', `Bearer ${first.body.token}`)
      .send({ pseudo: 'bob' });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.token).toBe(first.body.token);
  });

  it('l’admin libère un pseudo, un nouvel appareil peut alors entrer', async () => {
    const first = await request(env.app).post('/api/auth/enter').send({ pseudo: 'chloe' });

    const forbidden = await request(env.app).post(`/api/admin/users/${first.body.user.id}/release`);
    expect(forbidden.status).toBe(403);

    const released = await request(env.app)
      .post(`/api/admin/users/${first.body.user.id}/release`)
      .set('X-Admin-Key', ADMIN_KEY);
    expect(released.status).toBe(200);

    const newDevice = await request(env.app).post('/api/auth/enter').send({ pseudo: 'chloe' });
    expect(newDevice.status).toBe(200);
    expect(newDevice.body.token).not.toBe(first.body.token);

    // L'ancien appareil est déconnecté
    const old = await request(env.app)
      .get('/api/me')
      .set('Authorization', `Bearer ${first.body.token}`);
    expect(old.status).toBe(401);
  });
});

describe('Politique free', () => {
  it('laisse n’importe quel appareil entrer avec un pseudo existant', async () => {
    const env = await createTestEnv('free');
    try {
      await request(env.app).post('/api/auth/enter').send({ pseudo: 'dan' });
      const other = await request(env.app).post('/api/auth/enter').send({ pseudo: 'dan' });
      expect(other.status).toBe(200);
      expect(other.body.created).toBe(false);
    } finally {
      await env.cleanup();
    }
  });
});
