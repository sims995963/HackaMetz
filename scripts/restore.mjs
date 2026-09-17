/**
 * Restaure une sauvegarde produite par `npm run backup`.
 *
 *   npm run restore                          liste les sauvegardes disponibles
 *   npm run restore -- 2026-09-16T21-11-36   restaure celle-ci
 *   npm run restore -- --latest              restaure la plus récente
 *
 * Sécurités : refuse de tourner si le serveur écoute encore, et met les données actuelles
 * de côté (server/data.remplacé-<date>) au lieu de les écraser.
 */
import { cp, readdir, rename, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backupsDir = join(root, 'server', 'backups');
const PORT = Number(process.env.PORT ?? 3001);

const args = process.argv.slice(2);
const wantLatest = args.includes('--latest');
const wanted = args.find((a) => !a.startsWith('--'));

async function listBackups() {
  const entries = await readdir(backupsDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
    .map((e) => e.name)
    .sort();
}

const backups = await listBackups();
if (backups.length === 0) {
  console.log(`Aucune sauvegarde dans ${backupsDir}. Lance d'abord : npm run backup`);
  process.exit(1);
}

if (!wanted && !wantLatest) {
  console.log('\nSauvegardes disponibles :\n');
  for (const name of backups) {
    const { mtime } = await stat(join(backupsDir, name));
    console.log(`  ${name}   (${mtime.toLocaleString('fr-FR')})`);
  }
  console.log('\nRestaurer :  npm run restore -- <nom>   ou   npm run restore -- --latest\n');
  process.exit(0);
}

const name = wantLatest ? backups[backups.length - 1] : wanted;
if (!backups.includes(name)) {
  console.error(`Sauvegarde « ${name} » introuvable.`);
  process.exit(1);
}

// Le serveur doit être arrêté : restaurer sous ses pieds corromprait les fichiers JSON.
const portFree = await new Promise((resolve) => {
  const probe = createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(PORT, '0.0.0.0');
});
if (!portFree) {
  console.error(
    `\nLe port ${PORT} est occupé : le serveur tourne encore.\n` +
      '  Windows : Stop-ScheduledTask HackaMetz\n' +
      '  Linux   : sudo systemctl stop hackametz\n',
  );
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const source = join(backupsDir, name);

for (const folder of ['data', 'storage']) {
  const from = join(source, folder);
  const to = join(root, 'server', folder);
  if (!(await stat(from).catch(() => null))) {
    console.log(`  ${folder} : absent de la sauvegarde, ignoré`);
    continue;
  }
  if (await stat(to).catch(() => null)) {
    const aside = `${to}.remplace-${stamp}`;
    await rename(to, aside);
    console.log(`  ${folder} actuel mis de côté : ${aside}`);
  }
  await cp(from, to, { recursive: true });
  console.log(`  ${folder} restauré depuis ${name}`);
}

console.log(`\nRestauration terminée. Relance le serveur, puis : npm run doctor\n`);
