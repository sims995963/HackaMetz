import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Zip, ZipDeflate } from 'fflate';
import { AppError } from '../utils/errors';

/** Une entrée d'archive : un fichier du disque, ou un contenu produit à la volée. */
export interface ZipEntry {
  /** Chemin dans le zip, toujours avec des « / ». */
  name: string;
  /** Fichier source sur le disque. Absent si `content` est fourni. */
  path?: string;
  /** Contenu textuel généré (README, manifest). */
  content?: string;
  size: number;
}

export interface CollectOptions {
  /** Noms de dossiers jamais embarqués, quel que soit leur niveau. */
  skipDirs?: readonly string[];
  maxFiles: number;
  maxBytes: number;
}

const MAX_DEPTH = 24;

/**
 * Liste récursivement les fichiers d'un dossier sous forme d'entrées d'archive.
 *
 * Les bornes sont volontairement vérifiées ici, avant le moindre octet compressé : un
 * téléchargement refusé tout de suite vaut mieux qu'un zip interrompu à mi-parcours,
 * que le navigateur enregistrerait quand même comme un fichier corrompu.
 */
export async function collectFiles(
  root: string,
  prefix: string,
  options: CollectOptions,
): Promise<ZipEntry[]> {
  const skip = new Set(options.skipDirs ?? []);
  const entries: ZipEntry[] = [];
  let bytes = 0;

  async function walk(dir: string, relative: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    const children = await readdir(dir, { withFileTypes: true }).catch(() => []);
    // Ordre stable : deux téléchargements de la même base donnent la même archive.
    children.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const child of children) {
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      if (child.isDirectory()) {
        if (skip.has(child.name)) continue;
        await walk(join(dir, child.name), childRelative, depth + 1);
        continue;
      }
      if (!child.isFile()) continue; // liens symboliques et sockets : jamais suivis

      const info = await stat(join(dir, child.name)).catch(() => null);
      if (!info) continue;
      entries.push({
        name: prefix ? `${prefix}/${childRelative}` : childRelative,
        path: join(dir, child.name),
        size: info.size,
      });
      bytes += info.size;
      if (entries.length > options.maxFiles) {
        throw new AppError(
          413,
          'VALIDATION_ERROR',
          `Archive trop grande : plus de ${options.maxFiles} fichiers. Télécharge édition par édition.`,
        );
      }
      if (bytes > options.maxBytes) {
        throw new AppError(
          413,
          'VALIDATION_ERROR',
          `Archive trop lourde : plus de ${Math.round(options.maxBytes / 1024 / 1024)} Mo. Télécharge édition par édition.`,
        );
      }
    }
  }

  await walk(root, '', 0);
  return entries;
}

/** Taille totale annoncée, avant compression : sert à prévenir l'utilisateur. */
export function totalBytes(entries: ZipEntry[]): number {
  return entries.reduce((sum, e) => sum + e.size, 0);
}

/**
 * Construit le zip en flux : les fichiers sont lus et compressés au fur et à mesure,
 * jamais tous chargés en mémoire. Le débit du client fait pression sur la lecture
 * (un navigateur lent ne fait pas gonfler la mémoire du serveur).
 */
export function createZipStream(entries: ZipEntry[]): Readable {
  let drain: (() => void) | null = null;
  let full = false;

  const out = new Readable({
    read() {
      full = false;
      const resume = drain;
      drain = null;
      resume?.();
    },
  });

  const waitForDrain = () =>
    full ? new Promise<void>((resolve) => (drain = resolve)) : Promise.resolve();

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      out.destroy(err);
      return;
    }
    if (chunk.length > 0 && !out.push(Buffer.from(chunk))) full = true;
    if (final) out.push(null);
  });

  void (async () => {
    try {
      for (const entry of entries) {
        const file = new ZipDeflate(entry.name, { level: 6 });
        zip.add(file);
        if (entry.content !== undefined) {
          file.push(Buffer.from(entry.content, 'utf8'), true);
          await waitForDrain();
          continue;
        }
        let last: Buffer | null = null;
        for await (const chunk of createReadStream(entry.path!, { highWaterMark: 1 << 16 })) {
          // On garde un morceau d'avance : fflate a besoin de savoir lequel est le dernier.
          if (last) file.push(last, false);
          last = chunk as Buffer;
          await waitForDrain();
        }
        file.push(last ?? Buffer.alloc(0), true);
      }
      zip.end();
    } catch (err) {
      out.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return out;
}
