import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Open } from 'unzipper';
import { isExcludedPath } from '@hackametz/shared';
import { AppError } from '../utils/errors';
import { sanitizeSegment, splitRelativePath } from './safePath';
import { isScannable, scanFile } from './secrets';

export interface ExtractLimits {
  maxFiles: number;
  /** Taille totale décompressée autorisée. */
  maxBytes: number;
}

export interface ExtractResult {
  fileCount: number;
  sizeBytes: number;
  skippedCount: number;
  languages: Record<string, number>;
  hasReadme: boolean;
  /** « src/config.js : clé AWS » — le candidat est prévenu, rien n'est bloqué. */
  warnings: string[];
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.cs': 'C#',
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.rs': 'Rust',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.dart': 'Dart',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.ps1': 'PowerShell',
  '.md': 'Markdown',
  '.json': 'JSON',
  '.yml': 'YAML',
  '.yaml': 'YAML',
};

const isSymlink = (externalFileAttributes: number) =>
  ((externalFileAttributes >>> 16) & 0xf000) === 0xa000;

/** Garde-fou : une entrée qui annonce N octets ne peut pas en produire beaucoup plus (zip bomb). */
function sizeGuard(declared: number, path: string) {
  const allowed = declared * 1.5 + 1024 * 1024;
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > allowed) {
        cb(
          new AppError(
            400,
            'VALIDATION_ERROR',
            `Archive suspecte : ${path} dépasse sa taille annoncée`,
          ),
        );
        return;
      }
      cb(null, chunk);
    },
  });
}

/**
 * Extrait une archive zip dans `targetDir` en écartant les dossiers inutiles, les fichiers
 * sensibles, les liens symboliques et tout chemin qui sortirait de la cible (zip slip).
 * Si toutes les entrées sont sous un même dossier racine (zip d'un dossier), ce niveau est retiré.
 */
export async function extractZip(
  zipPath: string,
  targetDir: string,
  limits: ExtractLimits,
): Promise<ExtractResult> {
  const directory = await Open.file(zipPath).catch(() => {
    throw new AppError(400, 'VALIDATION_ERROR', "Le fichier n'est pas une archive zip valide");
  });

  const entries = directory.files
    .map((entry) => ({ entry, segments: splitRelativePath(entry.path) }))
    .filter((e) => e.segments !== null && e.segments.length > 0 && e.entry.type === 'File')
    .map((e) => ({ entry: e.entry, segments: e.segments as string[] }));

  if (entries.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', "L'archive ne contient aucun fichier");
  }

  const declaredTotal = entries.reduce((sum, e) => sum + e.entry.uncompressedSize, 0);
  if (declaredTotal > limits.maxBytes) {
    const mb = Math.round(declaredTotal / 1024 / 1024);
    throw new AppError(
      413,
      'VALIDATION_ERROR',
      `Archive trop volumineuse une fois décompressée (${mb} Mo, maximum ${Math.round(limits.maxBytes / 1024 / 1024)} Mo)`,
    );
  }

  // Dossier racine unique → on le retire pour que le code soit directement dans source/.
  const roots = new Set(entries.map((e) => e.segments[0]));
  const stripRoot = roots.size === 1 && entries.every((e) => e.segments.length > 1);

  const result: ExtractResult = {
    fileCount: 0,
    sizeBytes: 0,
    skippedCount: 0,
    languages: {},
    hasReadme: false,
    warnings: [],
  };
  const rootWithSep = targetDir.endsWith(sep) ? targetDir : targetDir + sep;

  for (const { entry, segments } of entries) {
    const relSegments = stripRoot ? segments.slice(1) : segments;
    const relPath = relSegments.join('/');

    if (isExcludedPath(relPath) || isSymlink(entry.externalFileAttributes)) {
      result.skippedCount += 1;
      continue;
    }

    const dest = resolve(targetDir, ...relSegments.map(sanitizeSegment));
    if (!dest.startsWith(rootWithSep)) {
      result.skippedCount += 1;
      continue;
    }

    if (result.fileCount >= limits.maxFiles) {
      throw new AppError(
        413,
        'VALIDATION_ERROR',
        `Trop de fichiers dans l'archive (maximum ${limits.maxFiles}). As-tu bien exclu node_modules ?`,
      );
    }

    await mkdir(dirname(dest), { recursive: true });
    await pipeline(
      entry.stream(),
      sizeGuard(entry.uncompressedSize, relPath),
      createWriteStream(dest),
    );

    result.fileCount += 1;
    result.sizeBytes += entry.uncompressedSize;
    const language = LANGUAGE_BY_EXT[extname(relPath).toLowerCase()];
    if (language) result.languages[language] = (result.languages[language] ?? 0) + 1;
    if (relSegments.length === 1 && /^readme(\.md|\.txt|\.rst)?$/i.test(relPath)) {
      result.hasReadme = true;
    }
    if (result.warnings.length < 20 && isScannable(relPath, entry.uncompressedSize)) {
      const kind = await scanFile(dest);
      if (kind) result.warnings.push(`${relPath} : ${kind}`);
    }
  }

  if (result.fileCount === 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      "Aucun fichier exploitable dans l'archive (tout a été filtré : node_modules, .env, liens…)",
    );
  }

  return result;
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}
