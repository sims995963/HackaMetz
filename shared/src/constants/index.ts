// Source de vérité des énumérations et limites, partagée front / back.

export const USER_ROLES = ['participant', 'jury', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PSEUDO_POLICIES = ['free', 'device-bound'] as const;
export type PseudoPolicy = (typeof PSEUDO_POLICIES)[number];

export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PSEUDO_REGEX = /^[a-zA-Z0-9_-]+$/;
export const RESERVED_PSEUDOS = [
  'admin',
  'jury',
  'system',
  'hackametz',
  'hackbase',
  'organisateur',
] as const;

export const HACKATHON_STATUSES = [
  'draft',
  'published',
  'running',
  'submissions_closed',
  'judging',
  'finished',
  'archived',
] as const;
export type HackathonStatus = (typeof HACKATHON_STATUSES)[number];

export const HACKATHON_STATUS_LABELS: Record<HackathonStatus, string> = {
  draft: 'Brouillon',
  published: 'À venir',
  running: 'En cours',
  submissions_closed: 'Soumissions closes',
  judging: 'Délibération',
  finished: 'Terminé',
  archived: 'Archivé',
};

/** Statuts visibles par tout le monde (les brouillons ne le sont que pour l'admin). */
export const PUBLIC_HACKATHON_STATUSES: readonly HackathonStatus[] = HACKATHON_STATUSES.filter(
  (s) => s !== 'draft',
);

export const HACKATHON_FORMATS = ['online', 'onsite', 'hybrid'] as const;
export type HackathonFormat = (typeof HACKATHON_FORMATS)[number];

export const HACKATHON_FORMAT_LABELS: Record<HackathonFormat, string> = {
  online: 'En ligne',
  onsite: 'Sur place',
  hybrid: 'Hybride',
};

export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const SUBMISSION_FORMATS = ['zip', 'folder'] as const;
export type SubmissionFormat = (typeof SUBMISSION_FORMATS)[number];

export const SUBMISSION_FIELDS = ['pitch', 'techStack', 'repoUrl', 'demoUrl', 'videoUrl'] as const;
export type SubmissionField = (typeof SUBMISSION_FIELDS)[number];

export const DEFAULT_LICENSE = 'MIT';
export const DEFAULT_TIMEZONE = 'Europe/Paris';

/** Largeur du numéro de hackathon : 001, 002… */
export const HACKATHON_CODE_WIDTH = 3;

export const SUBMISSION_STATUSES = ['submitted', 'late', 'disqualified'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  submitted: 'Déposé',
  late: 'Déposé en retard',
  disqualified: 'Disqualifié',
};

/** Transitions de statut qu'un admin peut déclencher (le scheduler n'en fait que deux : published→running, running→submissions_closed). */
export const STATUS_TRANSITIONS: Record<HackathonStatus, readonly HackathonStatus[]> = {
  draft: ['published'],
  published: ['draft', 'running'],
  running: ['submissions_closed'],
  submissions_closed: ['running', 'judging'],
  judging: ['submissions_closed', 'finished'],
  finished: ['judging', 'archived'],
  archived: ['finished'],
};

export const STATUSES_OPEN_FOR_REGISTRATION: readonly HackathonStatus[] = ['published', 'running'];

/** Dossiers jamais archivés : filtrés côté client avant compression, et côté serveur à l'extraction. */
export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.cache',
  '.parcel-cache',
  '.turbo',
  'target',
  'vendor',
  'coverage',
  '.idea',
  '.vscode',
  '.DS_Store',
  'bin',
  'obj',
] as const;

/** Fichiers sensibles ou inutiles, testés sur le nom de fichier seul. */
export const EXCLUDED_FILE_PATTERNS: readonly RegExp[] = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /^credentials.*\.json$/i,
  /^service[-_]?account.*\.json$/i,
  /^id_(rsa|ed25519|ecdsa)(\.pub)?$/i,
  /\.(log|tmp|swp)$/i,
  /^\.DS_Store$/,
  /^Thumbs\.db$/i,
  /^desktop\.ini$/i,
];

export function isExcludedDir(name: string): boolean {
  return (EXCLUDED_DIRS as readonly string[]).includes(name);
}

export function isExcludedFile(name: string): boolean {
  return EXCLUDED_FILE_PATTERNS.some((re) => re.test(name));
}

/** Un chemin relatif (séparateur /) est-il à écarter ? */
export function isExcludedPath(relativePath: string): boolean {
  const segments = relativePath.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] ?? '';
  return segments.slice(0, -1).some(isExcludedDir) || isExcludedFile(fileName);
}

/** Taille max d'un fichier individuel côté client (au-delà : ignoré avec avertissement). */
export const MAX_SINGLE_FILE_MB = 25;

/** Taille max du contenu d'un fichier renvoyé par l'API (viewer de code). */
export const MAX_VIEWABLE_FILE_BYTES = 256 * 1024;
