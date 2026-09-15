import { z } from 'zod';
import {
  DEFAULT_LICENSE,
  DEFAULT_TIMEZONE,
  HACKATHON_FORMATS,
  HACKATHON_STATUSES,
  SUBMISSION_FIELDS,
  SUBMISSION_FORMATS,
  VISIBILITIES,
} from '../constants';

// ---------------------------------------------------------------------------
// Sous-objets
// ---------------------------------------------------------------------------

export const criterionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  /** Poids relatif dans la note finale. */
  weight: z.number().positive().default(1),
  maxScore: z.number().int().positive().default(10),
});
export type Criterion = z.infer<typeof criterionSchema>;

/** Un critère saisi par l'admin : l'id est attribué par le serveur. */
export const criterionInputSchema = criterionSchema.omit({ id: true });

export const prizeSchema = z.object({
  rank: z.number().int().positive(),
  label: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
});
export type Prize = z.infer<typeof prizeSchema>;

export const resourceSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.url(),
});
export type Resource = z.infer<typeof resourceSchema>;

export const milestoneSchema = z.object({
  label: z.string().min(1).max(80),
  at: z.iso.datetime(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const hackathonDatesSchema = z.object({
  registrationOpensAt: z.iso.datetime().nullable().default(null),
  startsAt: z.iso.datetime(),
  submissionDeadlineAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  resultsAt: z.iso.datetime().nullable().default(null),
});
export type HackathonDates = z.infer<typeof hackathonDatesSchema>;

export const teamSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  minSize: z.number().int().min(1).default(1),
  maxSize: z.number().int().min(1).default(4),
});
export type TeamSettings = z.infer<typeof teamSettingsSchema>;

export const submissionSettingsSchema = z.object({
  formats: z.array(z.enum(SUBMISSION_FORMATS)).min(1).default(['zip', 'folder']),
  maxSizeMb: z.number().int().positive().default(50),
  maxFiles: z.number().int().positive().default(2000),
  allowResubmit: z.boolean().default(true),
  allowLate: z.boolean().default(false),
  requiredFields: z.array(z.enum(SUBMISSION_FIELDS)).default(['pitch', 'techStack']),
  license: z.string().min(1).default(DEFAULT_LICENSE),
});
export type SubmissionSettings = z.infer<typeof submissionSettingsSchema>;

// ---------------------------------------------------------------------------
// Partie éditable par l'admin (= formulaire de création / édition)
// ---------------------------------------------------------------------------

const hackathonEditableFields = {
  title: z.string().trim().min(3).max(120),
  theme: z.string().trim().min(3).max(200),
  /** Markdown. */
  description: z.string().max(20_000).default(''),
  /** Markdown. */
  rules: z.string().max(20_000).default(''),
  coverColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue, ex. #1E56D9')
    .default('#1E56D9'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  format: z.enum(HACKATHON_FORMATS).default('online'),
  location: z.string().max(200).default(''),
  timezone: z.string().default(DEFAULT_TIMEZONE),
  dates: hackathonDatesSchema,
  milestones: z.array(milestoneSchema).default([]),
  team: teamSettingsSchema.default({ enabled: false, minSize: 1, maxSize: 4 }),
  maxParticipants: z.number().int().positive().nullable().default(null),
  visibility: z.enum(VISIBILITIES).default('public'),
  accessCode: z.string().trim().min(4).max(32).nullable().default(null),
  submission: submissionSettingsSchema.default({
    formats: ['zip', 'folder'],
    maxSizeMb: 50,
    maxFiles: 2000,
    allowResubmit: true,
    allowLate: false,
    requiredFields: ['pitch', 'techStack'],
    license: DEFAULT_LICENSE,
  }),
  prizes: z.array(prizeSchema).default([]),
  resources: z.array(resourceSchema).default([]),
  juryIds: z.array(z.string()).default([]),
  /** Les participants peuvent voter pour un projet (coup de cœur du public). */
  publicVote: z.boolean().default(true),
};

export const datesAreOrdered = (dates: HackathonDates) =>
  new Date(dates.startsAt) <= new Date(dates.submissionDeadlineAt) &&
  new Date(dates.submissionDeadlineAt) <= new Date(dates.endsAt);

/** Partie éditable, sans les contrôles croisés (sert aussi de base aux formulaires côté client). */
export const hackathonEditableSchema = z.object({
  ...hackathonEditableFields,
  /** Optionnel : généré à partir du titre si absent. */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug : minuscules, chiffres et tirets')
    .optional(),
  criteria: z.array(criterionInputSchema).default([]),
  /** Tour de propositions dont ce hackathon est issu (lie le gagnant au hackathon créé). */
  fromRoundId: z.string().optional(),
});

export const createHackathonInputSchema = hackathonEditableSchema
  .refine((h) => datesAreOrdered(h.dates), {
    error: 'Les dates doivent être ordonnées : début ≤ deadline de soumission ≤ fin',
    path: ['dates', 'submissionDeadlineAt'],
  })
  .refine((h) => !h.team.enabled || h.team.minSize <= h.team.maxSize, {
    error: "La taille minimale d'équipe doit être ≤ la taille maximale",
    path: ['team', 'maxSize'],
  });
/** Ce que le client envoie (les champs avec valeur par défaut sont optionnels). */
export type CreateHackathonInput = z.input<typeof createHackathonInputSchema>;
/** Ce que le serveur obtient après validation (tout est renseigné). */
export type CreateHackathonData = z.output<typeof createHackathonInputSchema>;

/** Modification partielle : les contrôles croisés sont refaits par le serveur sur l'entité fusionnée. */
export const updateHackathonInputSchema = hackathonEditableSchema
  .omit({ criteria: true })
  .extend({ criteria: z.array(criterionInputSchema.extend({ id: z.string().optional() })) })
  .partial();
export type UpdateHackathonInput = z.input<typeof updateHackathonInputSchema>;
export type UpdateHackathonData = z.output<typeof updateHackathonInputSchema>;

export const statusChangeInputSchema = z.object({
  status: z.enum(HACKATHON_STATUSES),
});
export type StatusChangeInput = z.infer<typeof statusChangeInputSchema>;

// ---------------------------------------------------------------------------
// Entité complète (telle que stockée et renvoyée par l'API)
// ---------------------------------------------------------------------------

export const hackathonSchema = z.object({
  id: z.string(),
  /** Numéro séquentiel, jamais réutilisé : 1, 2, 3… */
  number: z.number().int().positive(),
  /** Numéro formaté pour les dossiers : 001, 002… */
  code: z.string().regex(/^\d{3,}$/),
  slug: z.string(),
  ...hackathonEditableFields,
  criteria: z.array(criterionSchema).default([]),
  status: z.enum(HACKATHON_STATUSES),
  /** Chemin du dossier de la base de connaissance, relatif à STORAGE_PATH. */
  storagePath: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Hackathon = z.infer<typeof hackathonSchema>;

export const hackathonCountsSchema = z.object({
  participants: z.number().int().nonnegative(),
  submissions: z.number().int().nonnegative(),
});
export type HackathonCounts = z.infer<typeof hackathonCountsSchema>;

/** Ce que l'API renvoie : l'entité + des compteurs calculés. */
export const hackathonWithCountsSchema = hackathonSchema.extend({ counts: hackathonCountsSchema });
export type HackathonWithCounts = z.infer<typeof hackathonWithCountsSchema>;

export const hackathonListResponseSchema = z.object({
  hackathons: z.array(hackathonWithCountsSchema),
});
export type HackathonListResponse = z.infer<typeof hackathonListResponseSchema>;

export const hackathonResponseSchema = z.object({
  hackathon: hackathonWithCountsSchema,
});
export type HackathonResponse = z.infer<typeof hackathonResponseSchema>;

export const hackathonListQuerySchema = z.object({
  status: z.enum(HACKATHON_STATUSES).optional(),
});
export type HackathonListQuery = z.infer<typeof hackathonListQuerySchema>;
