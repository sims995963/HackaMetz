import { z } from 'zod';
import { hackathonRefSchema } from './user.schema';

/** Un projet dans la galerie de la base de connaissance. */
export const kbProjectSchema = z.object({
  id: z.string(),
  hackathon: hackathonRefSchema,
  number: z.number().int(),
  title: z.string(),
  pitch: z.string(),
  ownerPseudo: z.string(),
  ownerType: z.enum(['user', 'team']),
  teamMembers: z.array(z.string()),
  techStack: z.array(z.string()),
  languages: z.record(z.string(), z.number()),
  fileCount: z.number().int(),
  status: z.string(),
  rank: z.number().int().nullable(),
  submittedAt: z.iso.datetime(),
});
export type KbProject = z.infer<typeof kbProjectSchema>;

export const kbProjectsResponseSchema = z.object({
  projects: z.array(kbProjectSchema),
  /** Toutes les technos rencontrées, pour les filtres. */
  technologies: z.array(z.string()),
});
export type KbProjectsResponse = z.infer<typeof kbProjectsResponseSchema>;

export const kbExportInputSchema = z.object({
  /** Crée un commit Git dans STORAGE_PATH (le dépôt est initialisé au besoin). */
  commit: z.boolean().default(false),
});

export const kbExportResponseSchema = z.object({
  hackathons: z.number().int(),
  projects: z.number().int(),
  readmes: z.number().int(),
  committed: z.boolean(),
  commitMessage: z.string().nullable(),
  gitError: z.string().nullable(),
});
export type KbExportResponse = z.infer<typeof kbExportResponseSchema>;
