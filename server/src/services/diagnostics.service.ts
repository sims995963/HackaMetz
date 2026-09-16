import { readdir, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import type { Diagnostics } from '@hackametz/shared';
import { logger } from '../utils/logger';

const CACHE_MS = 60_000;
/** Au-delà, on arrête de descendre : un dossier de dépôts peut contenir des dizaines de milliers de fichiers. */
const MAX_ENTRIES = 20_000;

/** Taille totale d'un dossier, bornée pour ne jamais bloquer une requête. */
async function directorySize(path: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  const stack = [path];
  while (stack.length > 0 && files < MAX_ENTRIES) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue; // dossier absent ou illisible : il ne compte pas
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        files += 1;
        try {
          bytes += (await stat(full)).size;
        } catch {
          // fichier disparu entre-temps
        }
      }
    }
  }
  return { bytes, files };
}

/**
 * Ce qui lâche vraiment pendant un hackathon : le disque, et la sauvegarde qu'on croyait faite.
 * Le calcul est mis en cache une minute — il parcourt le stockage.
 */
export class DiagnosticsService {
  private cache: { at: number; value: Diagnostics } | undefined;

  constructor(
    private readonly dataDir: string,
    private readonly storageDir: string,
  ) {}

  async read(): Promise<Diagnostics> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;

    const [data, storage, disk, lastBackupAt] = await Promise.all([
      directorySize(this.dataDir),
      directorySize(this.storageDir),
      this.disk(),
      this.lastBackupAt(),
    ]);

    const value: Diagnostics = {
      dataBytes: data.bytes,
      storageBytes: storage.bytes,
      storageFiles: storage.files,
      diskFreeBytes: disk.free,
      diskTotalBytes: disk.total,
      lastBackupAt,
    };
    this.cache = { at: Date.now(), value };
    return value;
  }

  private async disk(): Promise<{ free: number; total: number }> {
    try {
      const fs = await statfs(this.storageDir);
      return { free: fs.bsize * fs.bavail, total: fs.bsize * fs.blocks };
    } catch (error) {
      logger.warn({ error }, 'espace disque indisponible');
      return { free: 0, total: 0 };
    }
  }

  /** Date de la sauvegarde la plus récente produite par `npm run backup`. */
  private async lastBackupAt(): Promise<string | null> {
    try {
      const dir = join(this.dataDir, '..', 'backups');
      const entries = await readdir(dir, { withFileTypes: true });
      const times = await Promise.all(
        entries
          .filter((e) => /^\d{4}-\d{2}-\d{2}/.test(e.name))
          .map(async (e) => (await stat(join(dir, e.name))).mtimeMs),
      );
      if (times.length === 0) return null;
      return new Date(Math.max(...times)).toISOString();
    } catch {
      return null;
    }
  }
}
