import { strToU8, unzipSync, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

/** Un dépôt avec du code à garder et des choses que l'extraction doit écarter. */
function projectZip(): Buffer {
  return Buffer.from(
    zipSync({
      'monprojet/README.md': strToU8('# Mon projet'),
      'monprojet/src/index.js': strToU8('console.log("hello");'),
      'monprojet/node_modules/lib/index.js': strToU8('module.exports = 1;'),
      'monprojet/.env': strToU8('SECRET=oops'),
    }),
  );
}

const meta = {
  title: 'Mon projet',
  pitch: 'Un prototype',
  techStack: ['JavaScript'],
  repoUrl: '',
  consentPublish: true,
};

/** Noms des fichiers contenus dans le zip renvoyé par l'API. */
function entriesOf(body: Buffer): string[] {
  return Object.keys(unzipSync(new Uint8Array(body))).sort();
}

async function setup(env: TestEnv) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set('X-Admin-Key', ADMIN_KEY)
    .send(
      hackathonInput({
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  for (const status of ['published', 'running']) {
    await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ status });
  }

  const { body } = await request(env.app).post('/api/auth/enter').send({ pseudo: 'alice' });
  const token = body.token as string;
  await request(env.app)
    .post(`/api/hackathons/${slug}/registration`)
    .set('Authorization', `Bearer ${token}`)
    .send({ acceptRules: true });
  const submitted = await request(env.app)
    .post(`/api/hackathons/${slug}/submissions`)
    .set('Authorization', `Bearer ${token}`)
    .field('meta', JSON.stringify(meta))
    .attach('archive', projectZip(), 'monprojet.zip');
  expect(submitted.status).toBe(201);

  return { slug, submissionId: submitted.body.submission.id as string };
}

describe('Téléchargements zip', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('un projet, une édition, toute la base', async () => {
    const { slug, submissionId } = await setup(env);

    // --- Un projet : son manifest et son code, sans ce qui a été filtré à l'extraction.
    const project = await request(env.app)
      .get(`/api/submissions/${submissionId}/download.zip`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(project.status).toBe(200);
    expect(project.headers['content-type']).toBe('application/zip');
    expect(project.headers['content-disposition']).toContain('.zip');

    const names = entriesOf(project.body as Buffer);
    expect(names).toContain('001-mon-projet/project.json');
    expect(names).toContain('001-mon-projet/source/README.md');
    expect(names).toContain('001-mon-projet/source/src/index.js');
    // L'archive d'origine contient le .env et node_modules : elle ne part jamais.
    expect(names.some((n) => n.includes('archives/'))).toBe(false);
    expect(names.some((n) => n.includes('node_modules'))).toBe(false);
    expect(names.some((n) => n.endsWith('.env'))).toBe(false);

    // --- Une édition entière : README, manifest, et le projet.
    const edition = await request(env.app)
      .get(`/api/hackathons/${slug}/download.zip`)
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(edition.status).toBe(200);
    const editionNames = entriesOf(edition.body as Buffer);
    expect(editionNames.some((n) => n.endsWith('/hackathon.json'))).toBe(true);
    expect(editionNames.some((n) => n.endsWith('/projects/01-alice/source/README.md'))).toBe(true);

    // --- Toute la base, avec son index en tête.
    const kb = await request(env.app)
      .get('/api/kb/download.zip')
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(kb.status).toBe(200);
    const kbNames = entriesOf(kb.body as Buffer);
    expect(kbNames).toContain('hackametz-base-de-connaissance/README.md');
    expect(kbNames.some((n) => n.includes('/hackathons/001-'))).toBe(true);
  });

  it('les éditions en brouillon restent invisibles sans clé', async () => {
    const created = await request(env.app)
      .post('/api/hackathons')
      .set('X-Admin-Key', ADMIN_KEY)
      .send(hackathonInput());
    const slug = created.body.hackathon.slug as string;

    const anonymous = await request(env.app).get(`/api/hackathons/${slug}/download.zip`);
    expect(anonymous.status).toBe(404);

    // Pour l'organisateur, l'édition existe — mais elle n'a encore aucun projet.
    const admin = await request(env.app)
      .get(`/api/hackathons/${slug}/download.zip`)
      .set('X-Admin-Key', ADMIN_KEY);
    expect(admin.status).toBe(404);
    expect(admin.body.error.message).toContain('aucun projet');

    const emptyKb = await request(env.app).get('/api/kb/download.zip');
    expect(emptyKb.status).toBe(404);
  });

  it('le code de l’application est réservé à l’organisateur', async () => {
    const anonymous = await request(env.app).get('/api/app/source.zip');
    expect(anonymous.status).toBe(403);
  });
});
