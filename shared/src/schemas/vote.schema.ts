import { z } from 'zod';

/** Un participant vote pour un projet (pas le sien) : le « coup de cœur du public ». */
export const voteSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  submissionId: z.string(),
  userId: z.string(),
  createdAt: z.iso.datetime(),
});
export type Vote = z.infer<typeof voteSchema>;

export const castVoteInputSchema = z.object({ submissionId: z.string().min(1) });

export const votesResponseSchema = z.object({
  /** Vrai si le hackathon autorise le vote et qu'il est ouvert (en cours ou délibération). */
  open: z.boolean(),
  total: z.number().int(),
  /** Nombre de votes par projet. */
  counts: z.record(z.string(), z.number().int()),
  /** Projet pour lequel l'utilisateur courant a voté, s'il est identifié. */
  mine: z.string().nullable(),
});
export type VotesResponse = z.infer<typeof votesResponseSchema>;
