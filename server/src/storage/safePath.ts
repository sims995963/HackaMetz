import { resolve, sep } from 'node:path';

/** Octets 0-31 : construits sans echappement pour rester lisibles dans tous les outils. */
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}]`, 'g');
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Rend un segment de chemin (issu d'une archive ou d'une requête) inoffensif pour tous les OS :
 * caractères interdits sous Windows, noms réservés, points/espaces finaux, longueur.
 */
export function sanitizeSegment(segment: string): string {
  let clean = segment
    .replace(/[<>:"|?*]/g, '_')
    .replace(CONTROL_CHARS, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  if (clean === '' || clean === '.' || clean === '..') clean = '_';
  if (WINDOWS_RESERVED.test(clean)) clean = `_${clean}`;
  return clean;
}

/** "./src\\app.ts" → ["src", "app.ts"] ; renvoie null pour un chemin absolu ou remontant. */
export function splitRelativePath(raw: string): string[] | null {
  const normalized = raw.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split('/').filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..')) return null;
  return segments;
}

/** Résout `relative` à l'intérieur de `root`, ou renvoie null si le résultat en sortirait. */
export function resolveInside(root: string, relative: string): string | null {
  const segments = splitRelativePath(relative);
  if (!segments) return null;
  const target = resolve(root, ...segments);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return target === root || target.startsWith(rootWithSep) ? target : null;
}
