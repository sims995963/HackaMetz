import { z } from 'zod';
import { SUBMISSION_STATUSES } from '../constants';

// ---------------------------------------------------------------------------
// Métadonnées saisies par le candidat (envoyées en JSON dans le champ `meta` du multipart)
// ---------------------------------------------------------------------------

/** Champ URL optionnel : une chaîne vide devient null. */
const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.url('URL invalide').nullable().default(null),
);

export const submissionMetaSchema = z.object({
  title: z.string().trim().min(2, 'Titre trop court').max(120),
  pitch: z.string().trim().max(600, '600 caractères max').default(''),
  description: z.string().max(10_000).default(''),
  techStack: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  videoUrl: optionalUrl,
  consentPublish: z.literal(
    true,
    'Tu dois accepter que ton code soit publié dans la base de connaissance',
  ),
  /** Salon Discord de l'équipe exporté avec le projet à la fermeture : sur choix explicite. */
  archiveDiscord: z.boolean().default(false),
});
export type SubmissionMetaInput = z.input<typeof submissionMetaSchema>;
export type SubmissionMeta = z.output<typeof submissionMetaSchema>;

// ---------------------------------------------------------------------------
// Entité
// ---------------------------------------------------------------------------

export const submissionFilesSchema = z.object({
  /** Dossier du code extrait, relatif à STORAGE_PATH. */
  sourcePath: z.string(),
  /** Archive de la dernière version, relative à STORAGE_PATH. */
  archivePath: z.string(),
  /** Taille de l'archive. */
  archiveBytes: z.number().int().nonnegative(),
  /** Taille du code extrait (après filtrage). */
  sizeBytes: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  /** Fichiers écartés à l'extraction (node_modules, .env, chemins suspects…). */
  skippedCount: z.number().int().nonnegative(),
  /** Nombre de fichiers par langage, déduit des extensions. */
  languages: z.record(z.string(), z.number().int()),
  hasReadme: z.boolean(),
  sha256: z.string(),
  /** Avertissements du scan de secrets : « src/config.js : clé AWS ». */
  warnings: z.array(z.string()).default([]),
});
export type SubmissionFiles = z.infer<typeof submissionFilesSchema>;

export const submissionVersionSchema = z.object({
  version: z.number().int().positive(),
  archivePath: z.string(),
  archiveBytes: z.number().int().nonnegative(),
  sha256: z.string(),
  submittedAt: z.iso.datetime(),
});
export type SubmissionVersion = z.infer<typeof submissionVersionSchema>;

export const submissionSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  /** Rang de dépôt dans le hackathon : 1, 2, 3… (préfixe du dossier 01-, 02-…). */
  number: z.number().int().positive(),
  ownerType: z.enum(['user', 'team']),
  ownerId: z.string(),
  /** Pseudo du candidat, ou nom de l'équipe — dénormalisé pour l'affichage et le nom du dossier. */
  ownerPseudo: z.string(),
  /** Pseudos des membres quand le dépôt est celui d'une équipe. */
  teamMembers: z.array(z.string()).default([]),
  title: z.string(),
  pitch: z.string(),
  description: z.string(),
  techStack: z.array(z.string()),
  repoUrl: z.string().nullable(),
  demoUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  files: submissionFilesSchema,
  versions: z.array(submissionVersionSchema),
  status: z.enum(SUBMISSION_STATUSES),
  consent: z.object({
    publish: z.literal(true),
    license: z.string(),
    at: z.iso.datetime(),
    /** L'équipe a demandé que son salon Discord soit archivé avec le projet. */
    archiveDiscord: z.boolean().default(false),
  }),
  submittedByUserId: z.string(),
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Submission = z.infer<typeof submissionSchema>;

export const submissionResponseSchema = z.object({ submission: submissionSchema });
export type SubmissionResponse = z.infer<typeof submissionResponseSchema>;

export const submissionListResponseSchema = z.object({
  submissions: z.array(submissionSchema),
});
export type SubmissionListResponse = z.infer<typeof submissionListResponseSchema>;

// ---------------------------------------------------------------------------
// Navigation dans le code
// ---------------------------------------------------------------------------

export interface FileNode {
  name: string;
  /** Chemin relatif à la racine du projet, séparateur /. */
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export const fileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'dir']),
    size: z.number().optional(),
    children: z.array(fileNodeSchema).optional(),
  }),
);

export const treeResponseSchema = z.object({
  tree: fileNodeSchema,
  /** Vrai si l'arbre a été coupé (trop de fichiers ou trop profond). */
  truncated: z.boolean(),
});
export type TreeResponse = z.infer<typeof treeResponseSchema>;

export const fileContentResponseSchema = z.object({
  path: z.string(),
  size: z.number().int(),
  binary: z.boolean(),
  truncated: z.boolean(),
  /** Vide si binaire. */
  content: z.string(),
});
export type FileContentResponse = z.infer<typeof fileContentResponseSchema>;
