import { z } from 'zod';

export const FEEDBACK_MIN_RATING = 1;
export const FEEDBACK_MAX_RATING = 5;

/** Retour d'un participant une fois le hackathon terminé : un seul par personne, modifiable. */
export const feedbackSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  userId: z.string(),
  rating: z.number().int().min(FEEDBACK_MIN_RATING).max(FEEDBACK_MAX_RATING),
  /** Ce qui a plu. */
  liked: z.string().max(2000),
  /** Ce qu'il faudrait améliorer. */
  improve: z.string().max(2000),
  wouldReturn: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Feedback = z.infer<typeof feedbackSchema>;

export const feedbackInputSchema = z.object({
  rating: z.number().int().min(FEEDBACK_MIN_RATING).max(FEEDBACK_MAX_RATING),
  liked: z.string().trim().max(2000).default(''),
  improve: z.string().trim().max(2000).default(''),
  wouldReturn: z.boolean().default(true),
});
export type FeedbackInput = z.input<typeof feedbackInputSchema>;

/** Synthèse anonyme ; les commentaires ne sont renvoyés qu'à l'organisateur. */
export const feedbackSummarySchema = z.object({
  /** Vrai quand les participants peuvent (encore) répondre. */
  open: z.boolean(),
  count: z.number().int(),
  participants: z.number().int(),
  averageRating: z.number().nullable(),
  /** Nombre de réponses par note (index = note). */
  distribution: z.record(z.string(), z.number().int()),
  wouldReturnRate: z.number().nullable(),
  /** Retour de l'utilisateur courant, s'il en a laissé un. */
  mine: feedbackSchema.nullable(),
  /** Commentaires anonymisés (organisateur uniquement). */
  comments: z
    .array(
      z.object({
        rating: z.number().int(),
        liked: z.string(),
        improve: z.string(),
        wouldReturn: z.boolean(),
        at: z.iso.datetime(),
      }),
    )
    .default([]),
});
export type FeedbackSummary = z.infer<typeof feedbackSummarySchema>;

export const feedbackResponseSchema = z.object({ feedback: feedbackSchema });
