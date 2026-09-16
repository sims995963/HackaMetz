import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecord } from '../src/models/user.model';
import { createRepositories } from '../src/repositories';

describe('Lecture des fichiers JSON', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hackametz-repo-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const valid: UserRecord = {
    id: 'u1',
    pseudo: 'alice',
    pseudoNormalized: 'alice',
    avatarSeed: 'seed',
    role: 'participant' as const,
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    deviceTokenHashes: [],
  };

  it('écarte les enregistrements invalides, garde les bons et met le fichier en quarantaine', async () => {
    // Un fichier édité à la main : une ligne correcte, une ligne cassée.
    await writeFile(
      join(dir, 'users.json'),
      JSON.stringify({ items: [valid, { id: 'u2', pseudo: 42 }] }),
      'utf8',
    );
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const repos = createRepositories(dir);
    const users = await repos.users.all();
    expect(users.map((u) => u.pseudo)).toEqual(['alice']);

    const quarantined = await readdir(join(dir, '_quarantaine'));
    expect(quarantined).toHaveLength(1);
    // La copie garde l'original, enregistrement cassé compris : rien n'est perdu.
    const backup = JSON.parse(await readFile(join(dir, '_quarantaine', quarantined[0]!), 'utf8'));
    expect(backup.items).toHaveLength(2);

    // L'écriture suivante persiste la version nettoyée.
    await repos.users.insert({ ...valid, id: 'u3', pseudo: 'bob', pseudoNormalized: 'bob' });
    const onDisk = JSON.parse(await readFile(join(dir, 'users.json'), 'utf8'));
    expect(onDisk.items.map((u: { pseudo: string }) => u.pseudo)).toEqual(['alice', 'bob']);
    warn.mockRestore();
  });

  it('accepte un fichier absent ou vide sans broncher', async () => {
    const repos = createRepositories(dir);
    expect(await repos.hackathons.all()).toEqual([]);
    expect(await repos.users.count()).toBe(0);
  });

  it('ne met rien en quarantaine quand tout est valide', async () => {
    await writeFile(join(dir, 'users.json'), JSON.stringify({ items: [valid] }), 'utf8');
    const repos = createRepositories(dir);
    expect(await repos.users.count()).toBe(1);
    await expect(readdir(join(dir, '_quarantaine'))).rejects.toThrow();
  });
});
