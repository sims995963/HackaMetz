import { readFile } from 'node:fs/promises';

/** Motifs de secrets courants : on prévient le candidat, on ne bloque pas. */
const PATTERNS: { kind: string; regex: RegExp }[] = [
  { kind: 'clé AWS', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'clé API (sk-…)', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { kind: 'token GitHub', regex: /\bgh[pousr]_[A-Za-z0-9]{36}\b/ },
  { kind: 'token Slack', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { kind: 'clé Google', regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'clé privée', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  {
    kind: 'mot de passe ou secret en clair',
    regex: /\b(?:api[_-]?key|secret|password|passwd|token)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  },
];

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.php',
  '.java',
  '.kt',
  '.go',
  '.rs',
  '.cs',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.swift',
  '.dart',
  '.sh',
  '.ps1',
  '.bat',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
  '.env',
  '.txt',
  '.md',
  '.html',
  '.vue',
  '.svelte',
  '.xml',
  '.properties',
  '.gradle',
  '.sql',
  '.tf',
  '.example',
  '.sample',
]);

const MAX_SCAN_BYTES = 512 * 1024;

export function isScannable(relPath: string, size: number): boolean {
  if (size > MAX_SCAN_BYTES) return false;
  const name = relPath.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot).toLowerCase();
  return ext === '' || TEXT_EXTENSIONS.has(ext);
}

/** Renvoie le type de secret trouvé dans un fichier, ou null. */
export async function scanFile(absolutePath: string): Promise<string | null> {
  const content = await readFile(absolutePath, 'utf8').catch(() => '');
  for (const { kind, regex } of PATTERNS) {
    if (regex.test(content)) return kind;
  }
  return null;
}
