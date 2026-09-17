import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiscordBridge } from '../src/integrations/discord/discord.bridge';
import { FakeDiscordGateway } from './fakes/discord.gateway';
import { ADMIN_KEY, createTestEnv, hackathonInput, type TestEnv } from './helpers';

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

async function enter(env: TestEnv, pseudo: string): Promise<string> {
  const res = await request(env.app).post('/api/auth/enter').send({ pseudo });
  return res.body.token as string;
}

async function createEdition(env: TestEnv, publish = true): Promise<string> {
  const created = await request(env.app)
    .post('/api/hackathons')
    .set('X-Admin-Key', ADMIN_KEY)
    .send(
      hackathonInput({
        team: { enabled: true, minSize: 1, maxSize: 4 },
        dates: { startsAt: iso(-1), submissionDeadlineAt: iso(2), endsAt: iso(3) },
      }),
    );
  const slug = created.body.hackathon.slug as string;
  if (publish) {
    for (const status of ['published', 'running']) {
      await request(env.app)
        .post(`/api/hackathons/${slug}/status`)
        .set('X-Admin-Key', ADMIN_KEY)
        .send({ status });
    }
  }
  return slug;
}

async function joinAndCreateTeam(env: TestEnv, slug: string, pseudo: string, name: string) {
  const token = await enter(env, pseudo);
  await request(env.app)
    .post(`/api/hackathons/${slug}/registration`)
    .set('Authorization', `Bearer ${token}`)
    .send({ acceptRules: true });
  const res = await request(env.app)
    .post(`/api/hackathons/${slug}/teams`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  expect(res.status).toBe(201);
  return { token, team: res.body.team as { id: string; inviteCode: string; slug: string } };
}

describe('Pont Discord', () => {
  let env: TestEnv;
  let discord: FakeDiscordGateway;
  let bridge: DiscordBridge;

  beforeEach(async () => {
    env = await createTestEnv('free');
    discord = new FakeDiscordGateway();
    bridge = new DiscordBridge(env.ctx.repos, env.ctx.storage, discord, {
      inviteUrl: 'https://discord.gg/hackametz',
      graceHours: 48,
    });
    await bridge.start();
    env.ctx.hooks.attach(bridge);
  });
  afterEach(() => env.cleanup());

  it('sans pont, les réponses restent muettes sur Discord', async () => {
    env.ctx.hooks.detach();
    const slug = await createEdition(env);
    const res = await request(env.app).get(`/api/hackathons/${slug}`);
    expect(res.body.hackathon.discord).toBeNull();
    expect(discord.channels.size).toBe(0);
  });

  it('publier une édition ouvre son espace, créer une équipe ouvre ses salons privés', async () => {
    const slug = await createEdition(env);

    // Espace commun : une catégorie, annonces / accueil / general, un vocal.
    expect(discord.byType('category')).toHaveLength(1);
    expect(discord.byType('text').map((c) => c.name)).toEqual(['annonces', 'accueil', 'general']);
    expect(discord.byType('voice')).toHaveLength(1);
    const accueil = discord.byType('text').find((c) => c.name === 'accueil')!;
    expect(accueil.messages[0]?.pinned).toBe(true);
    expect(accueil.messages[0]?.content).toContain('/rejoindre');

    const shown = await request(env.app).get(`/api/hackathons/${slug}`);
    expect(shown.body.hackathon.discord).toEqual({ inviteUrl: 'https://discord.gg/hackametz' });

    // Une équipe : un rôle, un salon texte et un vocal ouverts à ce rôle seulement.
    const { token, team } = await joinAndCreateTeam(env, slug, 'alice', 'Les Mirabelles');
    const text = discord.byType('text').find((c) => c.name === 'les-mirabelles')!;
    const voice = discord.byType('voice').find((c) => c.name.includes('Les Mirabelles'))!;
    expect(text.access?.mode).toBe('private');
    expect(voice.access?.mode).toBe('private');
    const roleId = text.access?.roleIds?.[0];
    expect(discord.roles.get(roleId!)).toBe(`001-${team.slug}`);
    expect(text.messages[0]?.content).toContain('cochez la case');

    // L'API expose les liens profonds au membre de l'équipe.
    const mine = await request(env.app)
      .get(`/api/hackathons/${slug}/teams/mine`)
      .set('Authorization', `Bearer ${token}`);
    expect(mine.body.team.discord.textChannelUrl).toContain(text.id);
    expect(mine.body.team.discord.voiceChannelUrl).toContain(voice.id);

    // Idempotence : un tick de rattrapage ne recrée rien.
    const before = discord.channels.size;
    await bridge.tick();
    expect(discord.channels.size).toBe(before);
  });

  it('/rejoindre ouvre les salons avec le code d’équipe, /quitter les referme', async () => {
    const slug = await createEdition(env);
    const { team } = await joinAndCreateTeam(env, slug, 'alice', 'Les Mirabelles');

    const wrong = await discord.handler!({
      name: 'rejoindre',
      userId: 'u1',
      userName: 'Bob',
      code: 'ZZZZZZ',
    });
    expect(wrong).toContain('Aucune équipe');

    const ok = await discord.handler!({
      name: 'rejoindre',
      userId: 'u1',
      userName: 'Bob',
      code: team.inviteCode.toLowerCase(),
    });
    expect(ok).toContain('Les Mirabelles');
    expect(discord.rolesOf('u1')).toEqual([`001-${team.slug}`]);

    const quit = await discord.handler!({ name: 'quitter', userId: 'u1', userName: 'Bob' });
    expect(quit).toContain('C’est fait');
    expect(discord.rolesOf('u1')).toEqual([]);

    const nobody = await discord.handler!({ name: 'quitter', userId: 'u2', userName: 'Eve' });
    expect(nobody).toContain('aucun salon');
  });

  it('une annonce est relayée dans #annonces', async () => {
    const slug = await createEdition(env);
    await request(env.app)
      .post(`/api/hackathons/${slug}/announcements`)
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ title: 'Pizza à 20 h', content: 'Dans le hall.', pinned: true });
    const annonces = discord.byType('text').find((c) => c.name === 'annonces')!;
    expect(annonces.messages).toEqual([
      { content: '**Pizza à 20 h**\nDans le hall.', pinned: true },
    ]);
  });

  it('la fin de l’édition programme la fermeture ; le tick supprime, et archive sur demande', async () => {
    const slug = await createEdition(env);
    const { token, team } = await joinAndCreateTeam(env, slug, 'alice', 'Les Mirabelles');
    await joinAndCreateTeam(env, slug, 'bob', 'Les Discrets');

    // Alice dépose en demandant l'archivage ; Bob ne dépose rien.
    const submitted = await request(env.app)
      .post(`/api/hackathons/${slug}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .field(
        'meta',
        JSON.stringify({
          title: 'Métro léger',
          pitch: '',
          techStack: [],
          consentPublish: true,
          archiveDiscord: true,
        }),
      )
      .attach('archive', Buffer.from(zipSync({ 'p/README.md': strToU8('# p') })), 'p.zip');
    expect(submitted.status).toBe(201);
    expect(submitted.body.submission.consent.archiveDiscord).toBe(true);

    const text = discord.byType('text').find((c) => c.name === 'les-mirabelles')!;
    discord.history.set(text.id, [
      { authorName: 'alice', at: '2026-09-18T20:05:00.000Z', content: 'On part sur Leaflet ?' },
      { authorName: 'bob', at: '2026-09-18T20:06:30.000Z', content: 'Oui, et Pandas pour le CSV.' },
    ]);

    for (const status of ['submissions_closed', 'judging', 'finished']) {
      await request(env.app)
        .post(`/api/hackathons/${slug}/status`)
        .set('X-Admin-Key', ADMIN_KEY)
        .send({ status });
    }
    const links = await env.ctx.repos.discordLinks.all();
    expect(links.every((l) => l.closeAt !== null)).toBe(true);
    // Encore ouverts : la grâce n'est pas écoulée.
    await bridge.tick();
    expect(discord.channels.size).toBeGreaterThan(0);

    // On force l'échéance.
    for (const link of links) {
      await env.ctx.repos.discordLinks.update(link.id, { closeAt: iso(-1) });
    }
    await bridge.tick();
    expect(discord.channels.size).toBe(0);
    expect(discord.roles.size).toBe(0);
    expect(await env.ctx.repos.discordLinks.all()).toHaveLength(0);

    const journal = join(
      env.root,
      'storage',
      submitted.body.submission.files.sourcePath,
      '..',
      'journal.md',
    );
    expect(existsSync(journal)).toBe(true);
    const content = readFileSync(journal, 'utf8');
    expect(content).toContain('2 messages');
    expect(content).toContain('**20:05** alice — On part sur Leaflet ?');

    // Bob n'a rien déposé : rien d'archivé pour lui, et son équipe a quand même été fermée.
    expect(bridge.status().openSpaces).toBe(0);
    expect(team.id).toBeTruthy();
  });

  it('au-delà de 23 équipes, une deuxième catégorie s’ouvre', async () => {
    const slug = await createEdition(env);
    for (let i = 0; i < 24; i += 1) {
      await joinAndCreateTeam(env, slug, `participant${i}`, `Équipe ${i}`);
    }
    expect(discord.byType('category').map((c) => c.name)).toEqual([
      "#001 · IA pour l'éducation",
      "#001 · IA pour l'éducation · Équipes 2",
    ]);
    const first = discord.byType('category')[0]!.id;
    const inFirst = [...discord.channels.values()].filter((c) => c.parentId === first).length;
    expect(inFirst).toBeLessThanOrEqual(50);
  });
});
