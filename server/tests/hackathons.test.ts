import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

describe('Hackathons', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv();
  });
  afterEach(() => env.cleanup());

  it('la création est réservée à l’admin', async () => {
    const res = await request(env.app).post('/api/hackathons').send(hackathonInput());
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('numérote 001, 002… et crée le dossier de la base de connaissance', async () => {
    const first = await request(env.app)
      .post('/api/hackathons')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(hackathonInput());
    expect(first.status).toBe(201);
    expect(first.body.hackathon.code).toBe('001');
    expect(first.body.hackathon.slug).toBe('ia-pour-l-education');
    expect(first.body.hackathon.status).toBe('draft');
    expect(first.body.hackathon.team).toEqual({ enabled: false, minSize: 1, maxSize: 4 });

    const folder = join(env.root, 'storage', 'hackathons', '001-ia-pour-l-education');
    expect(existsSync(join(folder, 'projects'))).toBe(true);
    expect(existsSync(join(folder, 'hackathon.json'))).toBe(true);
    expect(readFileSync(join(folder, 'README.md'), 'utf8')).toContain(
      "# 001 — IA pour l'éducation",
    );

    const second = await request(env.app)
      .post('/api/hackathons')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(hackathonInput());
    expect(second.body.hackathon.code).toBe('002');
    expect(second.body.hackathon.slug).toBe('ia-pour-l-education-2');
  });

  it('refuse des dates incohérentes', async () => {
    const now = Date.now();
    const res = await request(env.app)
      .post('/api/hackathons')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(
        hackathonInput({
          dates: {
            startsAt: new Date(now + 3e8).toISOString(),
            submissionDeadlineAt: new Date(now + 1e8).toISOString(),
            endsAt: new Date(now + 4e8).toISOString(),
          },
        }),
      );
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('dates.submissionDeadlineAt');
  });

  it('les brouillons ne sont visibles que par l’admin', async () => {
    await request(env.app)
      .post('/api/hackathons')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(hackathonInput());

    const anonymous = await request(env.app).get('/api/hackathons');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.hackathons).toHaveLength(0);

    const admin = await request(env.app).get('/api/hackathons').set('X-Admin-Key', ADMIN_KEY);
    expect(admin.body.hackathons).toHaveLength(1);

    const detail = await request(env.app).get('/api/hackathons/ia-pour-l-education');
    expect(detail.status).toBe(404);
  });

  it('un statut de filtre inconnu est une erreur de validation', async () => {
    const res = await request(env.app).get('/api/hackathons?status=bidule');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Méta', () => {
  it('/api/health et /api/time répondent, une route inconnue renvoie 404', async () => {
    const env = await createTestEnv();
    try {
      const health = await request(env.app).get('/api/health');
      expect(health.body.status).toBe('ok');
      const time = await request(env.app).get('/api/time');
      expect(new Date(time.body.now).getTime()).toBeGreaterThan(0);
      const unknown = await request(env.app).get('/api/nope');
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('NOT_FOUND');
    } finally {
      await env.cleanup();
    }
  });
});
