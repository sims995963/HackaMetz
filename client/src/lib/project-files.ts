import { isExcludedDir, isExcludedFile, MAX_SINGLE_FILE_MB } from '@hackametz/shared';
import { zip, type Zippable } from 'fflate';

export interface CollectedFile {
  /** Chemin relatif au dossier déposé, séparateur /. */
  path: string;
  file: File;
}

export interface Collection {
  files: CollectedFile[];
  /** Chemins écartés (dossiers exclus, fichiers sensibles, trop gros). */
  skipped: string[];
  totalBytes: number;
  /** Vrai si l'utilisateur a déposé un zip tel quel. */
  isArchive: boolean;
}

const MAX_SINGLE_FILE_BYTES = MAX_SINGLE_FILE_MB * 1024 * 1024;

function empty(): Collection {
  return { files: [], skipped: [], totalBytes: 0, isArchive: false };
}

function accept(collection: Collection, path: string, file: File) {
  const name = path.split('/').pop() ?? path;
  if (isExcludedFile(name)) {
    collection.skipped.push(path);
    return;
  }
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    collection.skipped.push(`${path} (> ${MAX_SINGLE_FILE_MB} Mo)`);
    return;
  }
  collection.files.push({ path, file });
  collection.totalBytes += file.size;
}

/** Lit toutes les entrées d'un dossier (readEntries ne renvoie qu'un lot à la fois). */
function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const step = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) resolve(all);
        else {
          all.push(...batch);
          step();
        }
      }, reject);
    step();
  });
}

function entryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function walkEntry(entry: FileSystemEntry, prefix: string, collection: Collection) {
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    accept(collection, prefix + entry.name, file);
    return;
  }
  if (entry.isDirectory) {
    // On ne descend jamais dans node_modules & co : c'est là que se gagne le temps d'upload.
    if (isExcludedDir(entry.name)) {
      collection.skipped.push(`${prefix}${entry.name}/`);
      return;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (const child of await readAllEntries(reader)) {
      await walkEntry(child, `${prefix}${entry.name}/`, collection);
    }
  }
}

/** Fichiers issus d'un drag & drop : un zip tel quel, ou un dossier parcouru récursivement. */
export async function collectFromDrop(dataTransfer: DataTransfer): Promise<Collection> {
  const collection = empty();
  const items = Array.from(dataTransfer.items);
  const single = items.length === 1 ? items[0]?.getAsFile() : null;
  if (single && /\.zip$/i.test(single.name)) {
    collection.isArchive = true;
    collection.files.push({ path: single.name, file: single });
    collection.totalBytes = single.size;
    return collection;
  }
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await walkEntry(entry, '', collection);
    else {
      const file = item.getAsFile();
      if (file) accept(collection, file.name, file);
    }
  }
  return collection;
}

/** Fichiers issus d'un <input type="file" webkitdirectory> ou d'un <input accept=".zip">. */
export function collectFromInput(fileList: FileList): Collection {
  const collection = empty();
  const files = Array.from(fileList);
  const single = files[0];
  if (files.length === 1 && single && /\.zip$/i.test(single.name)) {
    collection.isArchive = true;
    collection.files.push({ path: single.name, file: single });
    collection.totalBytes = single.size;
    return collection;
  }
  for (const file of files) {
    const rel = (file.webkitRelativePath || file.name).split('/').slice(1).join('/') || file.name;
    const dirs = rel.split('/').slice(0, -1);
    if (dirs.some(isExcludedDir)) {
      collection.skipped.push(rel);
      continue;
    }
    accept(collection, rel, file);
  }
  return collection;
}

/** Compresse les fichiers collectés en un zip (fflate travaille dans des workers). */
export async function buildArchive(
  collection: Collection,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const only = collection.files[0];
  if (collection.isArchive && only) return only.file;

  const entries: Zippable = {};
  let done = 0;
  for (const { path, file } of collection.files) {
    entries[path] = new Uint8Array(await file.arrayBuffer());
    done += 1;
    onProgress?.(done / collection.files.length);
  }
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
