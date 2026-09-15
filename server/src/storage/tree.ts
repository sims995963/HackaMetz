import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileContentResponse, FileNode } from '@hackametz/shared';
import { MAX_VIEWABLE_FILE_BYTES } from '@hackametz/shared';
import { AppError } from '../utils/errors';
import { resolveInside } from './safePath';

const MAX_NODES = 3000;
const MAX_DEPTH = 12;

/** Arbre des fichiers d'un projet, dossiers d'abord, borné pour rester affichable. */
export async function buildTree(root: string): Promise<{ tree: FileNode; truncated: boolean }> {
  const state = { nodes: 0, truncated: false };

  async function walk(dir: string, relPath: string, depth: number): Promise<FileNode[]> {
    if (depth > MAX_DEPTH) {
      state.truncated = true;
      return [];
    }
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });
    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (state.nodes >= MAX_NODES) {
        state.truncated = true;
        break;
      }
      state.nodes += 1;
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: childRel,
          type: 'dir',
          children: await walk(join(dir, entry.name), childRel, depth + 1),
        });
      } else if (entry.isFile()) {
        const { size } = await stat(join(dir, entry.name));
        nodes.push({ name: entry.name, path: childRel, type: 'file', size });
      }
    }
    return nodes;
  }

  const children = await walk(root, '', 0);
  return { tree: { name: '', path: '', type: 'dir', children }, truncated: state.truncated };
}

/** Un fichier est considéré binaire s'il contient un octet nul dans ses premiers Ko. */
function looksBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192);
  return sample.includes(0);
}

/** Contenu d'un fichier du projet pour le viewer, borné et jamais hors du dossier source. */
export async function readProjectFile(
  root: string,
  relativePath: string,
): Promise<FileContentResponse> {
  const target = resolveInside(root, relativePath);
  if (!target) throw AppError.notFound('Fichier');

  const info = await stat(target).catch(() => null);
  if (!info || !info.isFile()) throw AppError.notFound('Fichier');

  const buffer = await readFile(target);
  if (looksBinary(buffer)) {
    return { path: relativePath, size: info.size, binary: true, truncated: false, content: '' };
  }
  const truncated = buffer.length > MAX_VIEWABLE_FILE_BYTES;
  return {
    path: relativePath,
    size: info.size,
    binary: false,
    truncated,
    content: buffer.subarray(0, MAX_VIEWABLE_FILE_BYTES).toString('utf8'),
  };
}
