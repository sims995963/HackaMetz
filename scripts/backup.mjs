/**
 * Sauvegarde les données et les projets déposés.
 *
 *   npm run backup                 une copie immédiate
 *   npm run backup -- --keep 20    garde les 20 dernières (défaut : 10)
 *   npm run backup -- --every 30   recopie toutes les 30 minutes (à lancer pendant l'événement)
 *   npm run backup -- --to D:/cle  écrit ailleurs (disque externe, partage réseau)
 *
 * Une sauvegarde = un dossier horodaté contenant `data/`, `storage/` et un manifeste.
 * Restaurer : arrêter le serveur, remplacer server/data et server/storage par les copies, relancer.
 */
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function flag(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const keep = Math.max(1, Number.parseInt(flag('keep', '10'), 10) || 10);
const everyMinutes = Number.parseInt(flag('every', '0'), 10) || 0;
const destination = flag('to', join(root, 'server', 'backups'));

const sources = [
  { name: 'data', path: join(root, 'server', 'data') },
  { name: 'storage', path: join(root, 'server', 'storage') },
];

async function directorySize(path) {
  let bytes = 0;
  let files = 0;
  const stack = [path];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        files += 1;
        bytes += (await stat(full)).size;
      }
    }
  }
  return { bytes, files };
}

const mo = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

async function prune() {
  const entries = await readdir(destination, { withFileTypes: true }).catch(() => []);
  const backups = entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
    .map((e) => e.name)
    .sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) {
    await rm(join(destination, old), { recursive: true, force: true });
    console.log(`  ancienne sauvegarde supprimée : ${old}`);
  }
}

async function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const target = join(destination, stamp);
  await mkdir(target, { recursive: true });

  const manifest = { createdAt: new Date().toISOString(), sources: {} };
  let total = 0;

  for (const source of sources) {
    const exists = await stat(source.path).catch(() => null);
    if (!exists) {
      console.log(`  ${source.name} : dossier absent, ignoré`);
      continue;
    }
    await cp(source.path, join(target, source.name), { recursive: true });
    const size = await directorySize(join(target, source.name));
    manifest.sources[source.name] = size;
    total += size.bytes;
    console.log(`  ${source.name} : ${size.files} fichiers, ${mo(size.bytes)}`);
  }

  await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await prune();
  console.log(`Sauvegarde ${stamp} — ${mo(total)} → ${target}\n`);
}

await backup();

if (everyMinutes > 0) {
  console.log(`Prochaine sauvegarde dans ${everyMinutes} min (Ctrl+C pour arrêter).`);
  setInterval(
    () => {
      backup().catch((error) => console.error('Sauvegarde impossible :', error.message));
    },
    everyMinutes * 60 * 1000,
  );
}
