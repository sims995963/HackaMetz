import { z } from 'zod';

export const evaluationSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  submissionId: z.string(),
  juryId: z.string(),
  juryPseudo: z.string(),
  /** Note par critère, indexée par l'id du critère du hackathon. */
  scores: z.record(z.string(), z.number().nonnegative()),
  comment: z.string().max(2000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Evaluation = z.infer<typeof evaluationSchema>;

export const evaluationInputSchema = z.object({
  scores: z.record(z.string(), z.number().nonnegative()),
  comment: z.string().max(2000, '2000 caractères max').default(''),
});
export type EvaluationInput = z.input<typeof evaluationInputSchema>;

export const evaluationResponseSchema = z.object({ evaluation: evaluationSchema });
export const evaluationListResponseSchema = z.object({
  evaluations: z.array(evaluationSchema),
});
export type EvaluationListResponse = z.infer<typeof evaluationListResponseSchema>;

export const juryMemberSchema = z.object({
  id: z.string(),
  pseudo: z.string(),
  avatarSeed: z.string(),
});
export const juryResponseSchema = z.object({ jury: z.array(juryMemberSchema) });
export type JuryResponse = z.infer<typeof juryResponseSchema>;

export const setJuryInputSchema = z.object({
  pseudos: z.array(z.string().trim().min(1)).max(50),
});
export type SetJuryInput = z.infer<typeof setJuryInputSchema>;

/** Une ligne du classement. */
export const resultEntrySchema = z.object({
  rank: z.number().int().positive(),
  submissionId: z.string(),
  number: z.number().int(),
  title: z.string(),
  ownerPseudo: z.string(),
  ownerType: z.enum(['user', 'team']),
  teamMembers: z.array(z.string()),
  techStack: z.array(z.string()),
  status: z.string(),
  /** Score moyen normalisé sur 100 (null tant qu'aucun juré n'a noté). */
  score: z.number().nullable(),
  evaluationCount: z.number().int(),
  /** Moyenne par critère, sur la note max du critère. */
  byCriterion: z.record(z.string(), z.number()),
  prize: z.string().nullable(),
  /** Commentaires du jury, visibles une fois les résultats publiés. */
  comments: z.array(z.object({ juryPseudo: z.string(), comment: z.string() })),
  /** Votes du public reçus. */
  publicVotes: z.number().int().default(0),
});
export type ResultEntry = z.infer<typeof resultEntrySchema>;

export const resultsResponseSchema = z.object({
  /** Vrai quand le hackathon est terminé : classement visible par tous. */
  published: z.boolean(),
  juryCount: z.number().int(),
  entries: z.array(resultEntrySchema),
  /** Coup de cœur du public : projet le plus voté (null sans vote ou vote désactivé). */
  publicFavorite: z
    .object({ submissionId: z.string(), votes: z.number().int() })
    .nullable()
    .default(null),
});
export type ResultsResponse = z.infer<typeof resultsResponseSchema>;
