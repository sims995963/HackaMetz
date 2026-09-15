import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Remonte jusqu'au package.json le plus proche — fonctionne depuis src/ (tsx) comme depuis dist/ (bundle). */
function findPackageRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('package.json du serveur introuvable');
    dir = parent;
  }
}

export const serverRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)));
export const projectRoot = resolve(serverRoot, '..');
