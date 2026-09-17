/**
 * Contrôle avant l'événement : tout ce qui doit être vrai pour que la soirée se passe bien.
 *
 *   npm run doctor
 *
 * Sort en code 1 si quelque chose de bloquant manque : utilisable dans un script d'installation.
 */
import { execSync } from 'node:child_process';
import { access, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 3001);

const results = [];
const ok = (label, detail) => results.push({ level: 'ok', label, detail });
const warn = (label, detail) => results.push({ level: 'warn', label, detail });
const fail = (label, detail) => results.push({ level: 'fail', label, detail });

const exists = (path) =>
  access(path, constants.F_OK)
    .then(() => true)
    .catch(() => false);

const size = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
const go = (bytes) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} Go`;

// ---------------------------------------------------------------- Node
{
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) ok('Node.js', `v${process.versions.node}`);
  else if (major >= 20) warn('Node.js', `v${process.versions.node} — 22 recommandé`);
  else fail('Node.js', `v${process.versions.node} — il faut au moins Node 20`);
}

// ---------------------------------------------------------------- Clé d'organisateur
{
  const envPath = join(root, '.env');
  if (!(await exists(envPath))) {
    fail('Clé d’organisateur', 'pas de .env — lance : npm run admin-key');
  } else {
    const content = await readFile(envPath, 'utf8');
    const key = /^ADMIN_KEY=(.*)$/m.exec(content)?.[1]?.trim() ?? '';
    const examples = ['change-moi-avant-le-premier-hackathon', 'cle-admin-de-test', 'change-me'];
    if (key.length === 0) fail('Clé d’organisateur', 'ADMIN_KEY vide — npm run admin-key');
    else if (examples.includes(key)) fail('Clé d’organisateur', 'valeur d’exemple — npm run admin-key');
    else if (key.length < 24) warn('Clé d’organisateur', `${key.length} caractères — 24 minimum conseillés`);
    else ok('Clé d’organisateur', `${key.length} caractères`);

    const policy = /^PSEUDO_POLICY=(.*)$/m.exec(content)?.[1]?.trim() ?? 'device-bound';
    if (policy === 'device-bound') ok('Politique de pseudo', 'device-bound (un pseudo = un appareil)');
    else warn('Politique de pseudo', `${policy} — n’importe qui peut reprendre un pseudo`);
  }
}

// ---------------------------------------------------------------- Build
for (const [label, path] of [
  ['Build serveur', 'server/dist/server.js'],
  ['Build front', 'client/dist/index.html'],
]) {
  const full = join(root, path);
  if (!(await exists(full))) fail(label, `${path} absent — lance : npm run build`);
  else {
    const stats = await stat(full);
    const age = Math.round((Date.now() - stats.mtime.getTime()) / 3_600_000);
    const detail = `${size(stats.size)} · construit il y a ${age} h`;
    if (age > 24 * 7) warn(label, `${detail} — pense à reconstruire après un git pull`);
    else ok(label, detail);
  }
}

// ---------------------------------------------------------------- Dossiers de données
for (const [label, path] of [
  ['Base JSON', process.env.DATA_PATH ?? 'server/data'],
  ['Projets déposés', process.env.STORAGE_PATH ?? 'server/storage'],
]) {
  const full = join(root, path);
  const probe = join(full, '.doctor-test');
  try {
    await writeFile(probe, 'ok');
    await unlink(probe);
    ok(label, `${path} accessible en écriture`);
  } catch (error) {
    fail(label, `${path} non accessible en écriture (${error.code ?? error.message})`);
  }
}

// ---------------------------------------------------------------- Espace disque
try {
  const fs = await statfs(root);
  const free = fs.bsize * fs.bavail;
  const total = fs.bsize * fs.blocks;
  const ratio = total > 0 ? free / total : 1;
  if (free < 1024 ** 3) fail('Espace disque', `${go(free)} libres — trop peu pour des dépôts`);
  else if (ratio < 0.1) warn('Espace disque', `${go(free)} libres (${Math.round(ratio * 100)} %)`);
  else ok('Espace disque', `${go(free)} libres`);
} catch {
  warn('Espace disque', 'non mesurable sur ce système');
}

// ---------------------------------------------------------------- Sauvegardes
{
  const dir = join(root, 'server', 'backups');
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const backups = entries.filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.name));
  if (backups.length === 0) {
    warn('Sauvegardes', 'aucune — lance : npm run backup');
  } else {
    const times = await Promise.all(
      backups.map(async (e) => (await stat(join(dir, e.name))).mtimeMs),
    );
    const hours = Math.round((Date.now() - Math.max(...times)) / 3_600_000);
    const detail = `${backups.length} copie(s), la plus récente il y a ${hours} h`;
    if (hours > 24) warn('Sauvegardes', detail);
    else ok('Sauvegardes', detail);
  }
}

// ---------------------------------------------------------------- Port / serveur
{
  const reachable = await fetch(`http://localhost:${PORT}/api/health`, { signal: AbortSignal.timeout(3000) })
    .then((r) => r.ok)
    .catch(() => false);
  if (reachable) {
    ok('Serveur', `déjà en ligne sur le port ${PORT}`);
  } else {
    const free = await new Promise((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.once('listening', () => probe.close(() => resolve(true)));
      probe.listen(PORT, '0.0.0.0');
    });
    if (free) warn('Serveur', `arrêté, port ${PORT} libre — démarre-le (npm start ou la tâche planifiée)`);
    else fail('Serveur', `port ${PORT} occupé par autre chose`);
  }
}

// ---------------------------------------------------------------- Git
try {
  const status = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' }).trim();
  if (status.length === 0) ok('Dépôt Git', 'propre');
  else warn('Dépôt Git', `${status.split('\n').length} fichier(s) non commités`);
} catch {
  warn('Dépôt Git', 'pas un dépôt Git — aucune sauvegarde du code');
}

// ---------------------------------------------------------------- Rapport
const icons = { ok: '  ok  ', warn: ' !    ', fail: ' KO   ' };
console.log('\nContrôle avant événement\n');
for (const { level, label, detail } of results) {
  console.log(`${icons[level]} ${label.padEnd(22)} ${detail}`);
}

const failures = results.filter((r) => r.level === 'fail').length;
const warnings = results.filter((r) => r.level === 'warn').length;
console.log(
  `\n${results.length - failures - warnings} points OK, ${warnings} avertissement(s), ${failures} bloquant(s).\n`,
);
if (failures > 0) {
  console.log('Corrige les lignes « KO » avant d’ouvrir l’app aux participants.\n');
  process.exitCode = 1;
}
