import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

/** Un zip « réaliste » : dossier racine, README, code, et des choses à filtrer. */
function projectZip(extra: Record<string, string> = {}): Buffer {
  const files: Record<string, Uint8Array> = {
    'monprojet/README.md': strToU8('# Mon projet\n\nBonjour.'),
    'monprojet/src/index.js': strToU8('console.log("hello");'),
    'monprojet/node_modules/lib/index.js': strToU8('module.exports = 1;'),
    'monprojet/.env': strToU8('SECRET=oops'),
    'monprojet/notes.txt': strToU8('todo'),
  };
  for (const [path, content] of Object.entries(extra)) files[path] = strToU8(content);
  return Buffer.from(zipSync(files));
}

const meta = {
  title: 'Mon projet',
  pitch: 'Un prototype',
  techStack: ['JavaScript'],
  repoUrl: '',
  consentPublish: true,
};

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

/** Crée un hackathon et l'amène au statut demandé via les transitions admin. */
async function createHackathon(
  env: TestEnv,
  overrides: Record<string, unknown> = {},
  status: 'draft' | 'published' | 'running' = 'running',
): Promise<string> {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set('X-Admin-Key', ADMIN_KEY)
    .send(
      hackathonInput({
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
        ...overrides,
      }),
    );
  expect(created.status).toBe(201);
  const slug = created.body.hackathon.slug as string;
  const steps =
    status === 'draft' ? [] : status === 'published' ? ['published'] : ['published', 'running'];
  for (const next of steps) {
    const res = await request(env.app)
      .post(`/api/hackathons/${slug}/status`)
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ status: next });
    expect(res.status).toBe(200);
  }
  return slug;
}

describe('Inscriptions', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('rejoindre, compter, quitter', async () => {
    const slug = await createHackathon(env, {}, 'published');
    const token = await enter(env, 'alice');

    const anonymous = await request(env.app).post(`/api/hackathons/${slug}/registration`).send({});
    expect(anonymous.status).toBe(401);

    const noRules = await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(noRules.status).toBe(400);

    const joined = await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });
    expect(joined.status).toBe(201);

    const detail = await request(env.app).get(`/api/hackathons/${slug}`);
    expect(detail.body.hackathon.counts).toEqual({ participants: 1, submissions: 0 });

    const participants = await request(env.app).get(`/api/hackathons/${slug}/participants`);
    expect(participants.body.participants.map((p: { pseudo: string }) => p.pseudo)).toEqual([
      'alice',
    ]);

    const left = await request(env.app)
      .delete(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`);
    expect(left.status).toBe(204);
  });

  it("un hackathon privé exige le code d'accès, un hackathon plein refuse", async () => {
    const slug = await createHackathon(
      env,
      { visibility: 'private', accessCode: 'metz2026', maxParticipants: 1 },
      'published',
    );
    const alice = await enter(env, 'alice');
    const bob = await enter(env, 'bob');

    const wrong = await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ acceptRules: true, accessCode: 'nope' });
    expect(wrong.status).toBe(403);

    const ok = await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ acceptRules: true, accessCode: 'metz2026' });
    expect(ok.status).toBe(201);

    const full = await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ acceptRules: true, accessCode: 'metz2026' });
    expect(full.status).toBe(409);
  });

  it('le scheduler passe un hackathon publié en cours quand sa date arrive', async () => {
    const slug = await createHackathon(env, {}, 'published');
    const changed = await env.ctx.services.hackathons.applyScheduledTransitions();
    expect(changed.map((h) => h.slug)).toEqual([slug]);
    expect(changed[0]!.status).toBe('running');
  });
});

describe('Dépôt de projet', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('extrait le zip en filtrant, numérote le dossier et gère les versions', async () => {
    const slug = await createHackathon(env);
    const token = await enter(env, 'alice');

    const notRegistered = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', projectZip(), 'monprojet.zip');
    expect(notRegistered.status).toBe(403);

    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });

    const first = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', projectZip(), 'monprojet.zip');
    expect(first.status).toBe(201);
    const s = first.body.submission;
    expect(s.number).toBe(1);
    expect(s.status).toBe('submitted');
    expect(s.files.fileCount).toBe(3);
    expect(s.files.skippedCount).toBe(2);
    expect(s.files.hasReadme).toBe(true);
    expect(s.files.languages).toEqual({ JavaScript: 1, Markdown: 1 });
    expect(s.repoUrl).toBeNull();

    const projectDir = join(
      env.root,
      'storage',
      'hackathons',
      '001-ia-pour-l-education',
      'projects',
      '01-alice',
    );
    expect(existsSync(join(projectDir, 'source', 'README.md'))).toBe(true);
    expect(existsSync(join(projectDir, 'source', 'src', 'index.js'))).toBe(true);
    expect(existsSync(join(projectDir, 'source', '.env'))).toBe(false);
    expect(existsSync(join(projectDir, 'source', 'node_modules'))).toBe(false);
    expect(existsSync(join(projectDir, 'archives', 'v1.zip'))).toBe(true);
    expect(existsSync(join(projectDir, 'project.json'))).toBe(true);
    const readme = readFileSync(
      join(env.root, 'storage', 'hackathons', '001-ia-pour-l-education', 'README.md'),
      'utf8',
    );
    expect(readme).toContain('| 01 | Mon projet | alice |');

    const second = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify({ ...meta, title: 'Mon projet v2' }))
      .attach('archive', projectZip({ 'monprojet/src/app.js': 'x' }), 'monprojet.zip');
    expect(second.status).toBe(201);
    expect(second.body.submission.id).toBe(s.id);
    expect(second.body.submission.versions).toHaveLength(2);
    expect(second.body.submission.files.fileCount).toBe(4);
    expect(existsSync(join(projectDir, 'archives', 'v2.zip'))).toBe(true);

    const list = await request(env.app).get(`/api/hackathons/${slug}/submissions`);
    expect(list.body.submissions).toHaveLength(1);
    expect(list.body.submissions[0].title).toBe('Mon projet v2');
  });

  it('arbre de fichiers et lecture bornée au dossier source', async () => {
    const slug = await createHackathon(env);
    const token = await enter(env, 'bob');
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });
    const created = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', projectZip(), 'monprojet.zip');
    const id = created.body.submission.id;

    const tree = await request(env.app).get(`/api/submissions/${id}/tree`);
    expect(tree.status).toBe(200);
    const names = tree.body.tree.children.map((n: { name: string }) => n.name);
    expect(names).toEqual(['src', 'notes.txt', 'README.md']);

    const file = await request(env.app)
      .get(`/api/submissions/${id}/file`)
      .query({ path: 'src/index.js' });
    expect(file.body.content).toBe('console.log("hello");');

    const escape = await request(env.app)
      .get(`/api/submissions/${id}/file`)
      .query({ path: '../project.json' });
    expect(escape.status).toBe(404);
  });

  it('refuse un dépôt après la deadline, un fichier non zip, et une archive vide', async () => {
    const slug = await createHackathon(env, {
      dates: { startsAt: iso(-3), submissionDeadlineAt: iso(-1), endsAt: iso(1) },
    });
    const token = await enter(env, 'chloe');
    await request(env.app)
      .post(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });

    const late = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', projectZip(), 'monprojet.zip');
    expect(late.status).toBe(409);

    const open = await createHackathon(env, { title: 'Ouvert' });
    await request(env.app)
      .post(`/api/hackathons/${open}/registration`)
      .set('Authorization', `Bearer ${token}`)
      .send({ acceptRules: true });

    const notZip = await request(env.app)
      .post(`/api/hackathons/${open}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', Buffer.from('hello'), 'notes.txt');
    expect(notZip.status).toBe(400);

    const onlyJunk = Buffer.from(
      zipSync({ 'p/.env': strToU8('x'), 'p/node_modules/a.js': strToU8('y') }),
    );
    const empty = await request(env.app)
      .post(`/api/hackathons/${open}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', onlyJunk, 'p.zip');
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toContain('filtré');
  });
});
