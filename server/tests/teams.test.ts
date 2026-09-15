import { existsSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { join as joinPath } from 'node:path';
import type { HackathonEvent } from '@hackametz/shared';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const meta = { title: 'Projet équipe', pitch: '', techStack: [], consentPublish: true };

function zipOf(files: Record<string, string>): Buffer {
  return Buffer.from(
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))),
  );
}

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

async function runningTeamHackathon(
  env: TestEnv,
  team = { enabled: true, minSize: 2, maxSize: 3 },
) {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set('X-Admin-Key', ADMIN_KEY)
    .send(
      hackathonInput({
        team,
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
  return slug;
}

async function join(env: TestEnv, slug: string, token: string) {
  return request(env.app)
    .post(`/api/hackathons/${slug}/registration`)
    .set('Authorization', `Bearer ${token}`)
    .send({ acceptRules: true });
}

describe('Équipes', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('créer, rejoindre par code, taille bornée, quitter', async () => {
    const slug = await runningTeamHackathon(env);
    const alice = await enter(env, 'alice');
    const bob = await enter(env, 'bob');
    const chloe = await enter(env, 'chloe');
    const dan = await enter(env, 'dan');
    for (const t of [alice, bob, chloe, dan]) await join(env, slug, t);

    const notRegistered = await request(env.app)
      .post(`/api/hackathons/${slug}/teams`)
      .set('Authorization', `Bearer ${await enter(env, 'eve')}`)
      .send({ name: 'Les intrus' });
    expect(notRegistered.status).toBe(403);

    const created = await request(env.app)
      .post(`/api/hackathons/${slug}/teams`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ name: 'Team Rocket' });
    expect(created.status).toBe(201);
    const code = created.body.team.inviteCode as string;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.body.team.members.map((m: { pseudo: string }) => m.pseudo)).toEqual(['alice']);

    const duplicate = await request(env.app)
      .post(`/api/hackathons/${slug}/teams`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ name: 'team rocket' });
    expect(duplicate.status).toBe(409);

    const wrongCode = await request(env.app)
      .post(`/api/hackathons/${slug}/teams/join`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ inviteCode: 'ZZZZZZ' });
    expect(wrongCode.status).toBe(404);

    for (const t of [bob, chloe]) {
      const res = await request(env.app)
        .post(`/api/hackathons/${slug}/teams/join`)
        .set('Authorization', `Bearer ${t}`)
        .send({ inviteCode: code.toLowerCase() });
      expect(res.status).toBe(200);
    }
    const full = await request(env.app)
      .post(`/api/hackathons/${slug}/teams/join`)
      .set('Authorization', `Bearer ${dan}`)
      .send({ inviteCode: code });
    expect(full.status).toBe(409);

    // La liste publique ne divulgue pas le code ; les participants affichent leur équipe
    const teams = await request(env.app).get(`/api/hackathons/${slug}/teams`);
    expect(teams.body.teams).toHaveLength(1);
    expect(teams.body.teams[0]).not.toHaveProperty('inviteCode');
    const participants = await request(env.app).get(`/api/hackathons/${slug}/participants`);
    const dansRow = participants.body.participants.find(
      (p: { pseudo: string }) => p.pseudo === 'dan',
    );
    const bobsRow = participants.body.participants.find(
      (p: { pseudo: string }) => p.pseudo === 'bob',
    );
    expect(dansRow.teamName).toBeNull();
    expect(bobsRow.teamName).toBe('Team Rocket');

    // Le chef part : la direction passe au suivant ; quitter le hackathon exige de quitter l'équipe
    const cannotLeaveHackathon = await request(env.app)
      .delete(`/api/hackathons/${slug}/registration`)
      .set('Authorization', `Bearer ${alice}`);
    expect(cannotLeaveHackathon.status).toBe(409);

    const left = await request(env.app)
      .delete(`/api/hackathons/${slug}/teams/mine`)
      .set('Authorization', `Bearer ${alice}`);
    expect(left.status).toBe(204);
    const mine = await request(env.app)
      .get(`/api/hackathons/${slug}/teams/mine`)
      .set('Authorization', `Bearer ${bob}`);
    expect(mine.body.team.leaderId).toBe(bobsRow.id);
    expect(mine.body.team.inviteCode).toBe(code);
  });

  it('le dépôt est celui de l’équipe : taille minimale, dossier au nom de l’équipe, visible par tous les membres', async () => {
    const slug = await runningTeamHackathon(env);
    const alice = await enter(env, 'alice');
    const bob = await enter(env, 'bob');
    await join(env, slug, alice);
    await join(env, slug, bob);

    const noTeam = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${alice}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', zipOf({ 'p/README.md': '# p' }), 'p.zip');
    expect(noTeam.status).toBe(403);

    const team = await request(env.app)
      .post(`/api/hackathons/${slug}/teams`)
      .set('Authorization', `Bearer ${alice}`)
      .send({ name: 'Les Pixels' });

    const tooSmall = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${alice}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', zipOf({ 'p/README.md': '# p' }), 'p.zip');
    expect(tooSmall.status).toBe(409);

    await request(env.app)
      .post(`/api/hackathons/${slug}/teams/join`)
      .set('Authorization', `Bearer ${bob}`)
      .send({ inviteCode: team.body.team.inviteCode });

    const submitted = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${alice}`)
      .field('meta', JSON.stringify(meta))
      .attach('archive', zipOf({ 'p/README.md': '# p', 'p/main.py': 'print(1)' }), 'p.zip');
    expect(submitted.status).toBe(201);
    expect(submitted.body.submission.ownerType).toBe('team');
    expect(submitted.body.submission.ownerPseudo).toBe('Les Pixels');
    expect(submitted.body.submission.teamMembers).toEqual(['alice', 'bob']);
    expect(
      existsSync(
        joinPath(
          env.root,
          'storage',
          'hackathons',
          '001-ia-pour-l-education',
          'projects',
          '01-les-pixels',
          'source',
          'main.py',
        ),
      ),
    ).toBe(true);

    // Bob re-dépose pour l'équipe : même projet, version 2
    const again = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${bob}`)
      .field('meta', JSON.stringify({ ...meta, title: 'Projet équipe v2' }))
      .attach('archive', zipOf({ 'p/README.md': '# p2' }), 'p.zip');
    expect(again.body.submission.id).toBe(submitted.body.submission.id);
    expect(again.body.submission.versions).toHaveLength(2);
    expect(again.body.submission.submittedByUserId).not.toBe(
      submitted.body.submission.submittedByUserId,
    );

    const me = await request(env.app).get('/api/me').set('Authorization', `Bearer ${bob}`);
    expect(me.body.submissions).toHaveLength(1);
    expect(me.body.registrations[0].team.name).toBe('Les Pixels');
    expect(me.body.registrations[0].team.memberPseudos).toEqual(['alice', 'bob']);

    // L'équipe qui a déposé ne peut pas être dissoute
    await request(env.app)
      .delete(`/api/hackathons/${slug}/teams/mine`)
      .set('Authorization', `Bearer ${alice}`);
    const dissolve = await request(env.app)
      .delete(`/api/hackathons/${slug}/teams/mine`)
      .set('Authorization', `Bearer ${bob}`);
    expect(dissolve.status).toBe(409);
  });
});

describe('Annonces et temps réel', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await createTestEnv('free');
  });
  afterEach(() => env.cleanup());

  it('l’admin publie, tout le monde lit, le bus d’événements est alimenté', async () => {
    const slug = await runningTeamHackathon(env, { enabled: false, minSize: 1, maxSize: 1 });
    const events: HackathonEvent[] = [];
    const stop = env.ctx.events.subscribe(slug, (e) => events.push(e));

    const forbidden = await request(env.app)
      .post(`/api/hackathons/${slug}/announcements`)
      .send({ title: 'Pizza à 20h' });
    expect(forbidden.status).toBe(403);

    const created = await request(env.app)
      .post(`/api/hackathons/${slug}/announcements`)
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ title: 'Pizza à 20h', content: 'Salle B', pinned: true });
    expect(created.status).toBe(201);
    await request(env.app)
      .post(`/api/hackathons/${slug}/announcements`)
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ title: 'Deadline confirmée' });

    const list = await request(env.app).get(`/api/hackathons/${slug}/announcements`);
    expect(list.body.announcements.map((a: { title: string }) => a.title)).toEqual([
      'Pizza à 20h',
      'Deadline confirmée',
    ]);

    const token = await enter(env, 'alice');
    await join(env, slug, token);

    stop();
    expect(events.map((e) => e.type)).toEqual(['announcement', 'announcement', 'registration']);
    expect(events[2]!.message).toBe('alice a rejoint le hackathon');
  });

  it('le flux SSE envoie les événements du hackathon', async () => {
    const slug = await runningTeamHackathon(env, { enabled: false, minSize: 1, maxSize: 1 });
    const server = env.app.listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const received = await new Promise<{ status: number; type: string; text: string }>(
        (resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${port}/api/hackathons/${slug}/events`, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              text += chunk;
              if (text.includes('event: announcement')) {
                resolve({
                  status: res.statusCode ?? 0,
                  type: res.headers['content-type'] ?? '',
                  text,
                });
                req.destroy();
              }
            });
            res.on('error', reject);
            // Une fois connecté, l'admin publie : le flux doit relayer l'annonce.
            setTimeout(() => {
              void request(env.app)
                .post(`/api/hackathons/${slug}/announcements`)
                .set('X-Admin-Key', ADMIN_KEY)
                .send({ title: 'Pizza à 20h' })
                .then(() => undefined, reject);
            }, 50);
          });
          req.on('error', reject);
        },
      );
      expect(received.status).toBe(200);
      expect(received.type).toContain('text/event-stream');
      expect(received.text).toContain('retry: 3000');
      expect(received.text).toContain('"message":"Annonce : Pizza à 20h"');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('Scan de secrets', () => {
  it('signale une clé AWS sans bloquer le dépôt', async () => {
    const env = await createTestEnv('free');
    try {
      const slug = await runningTeamHackathon(env, { enabled: false, minSize: 1, maxSize: 1 });
      const token = await enter(env, 'alice');
      await join(env, slug, token);
      const res = await request(env.app)
        .post(`/api/hackathons/${slug}/submissions`)
        .set('Authorization', `Bearer ${token}`)
        .field('meta', JSON.stringify(meta))
        .attach(
          'archive',
          zipOf({
            'p/README.md': '# p',
            'p/config.js': 'const key = "AKIAIOSFODNN7EXAMPLE";',
            'p/ok.js': 'const x = 1;',
          }),
          'p.zip',
        );
      expect(res.status).toBe(201);
      expect(res.body.submission.files.warnings).toEqual(['config.js : clé AWS']);
    } finally {
      await env.cleanup();
    }
  });
});
