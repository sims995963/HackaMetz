import { z } from 'zod';
import { HACKATHON_STATUSES } from '../constants';

/** Chiffres affichés sur la page d'accueil. */
export const publicStatsSchema = z.object({
  hackathons: z.number().int(),
  running: z.number().int(),
  participants: z.number().int(),
  submissions: z.number().int(),
});
export type PublicStats = z.infer<typeof publicStatsSchema>;

export const activityItemSchema = z.object({
  type: z.enum(['registration', 'submission', 'user', 'question', 'feedback']),
  at: z.iso.datetime(),
  pseudo: z.string(),
  hackathonTitle: z.string().nullable(),
  hackathonSlug: z.string().nullable(),
  label: z.string(),
});
export type ActivityItem = z.infer<typeof activityItemSchema>;

/** Tableau de bord de l'organisateur. */
export const adminStatsSchema = publicStatsSchema.extend({
  users: z.number().int(),
  byStatus: z.record(z.enum(HACKATHON_STATUSES), z.number().int()),
  registrations: z.number().int(),
  activity: z.array(activityItemSchema),
  /** Questions sans réponse, par hackathon (seulement ceux qui en ont). */
  pendingQuestions: z
    .array(
      z.object({
        hackathonSlug: z.string(),
        hackathonTitle: z.string(),
        count: z.number().int(),
      }),
    )
    .default([]),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;
