import { z } from 'zod';

/** Question posée à l'organisateur sur la page d'un hackathon (FAQ vivante). */
export const questionSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  authorId: z.string(),
  authorPseudo: z.string(),
  content: z.string().min(1).max(1000),
  /** Réponse de l'organisateur, null tant qu'elle n'est pas rédigée. */
  answer: z
    .object({
      content: z.string().max(3000),
      byPseudo: z.string(),
      at: z.iso.datetime(),
    })
    .nullable(),
  /** Identifiants des personnes qui ont « +1 » la question. */
  upvoterIds: z.array(z.string()),
  createdAt: z.iso.datetime(),
});
export type Question = z.infer<typeof questionSchema>;

/** Ce que voit le client : le compteur de +1 et si l'utilisateur courant en fait partie. */
export const questionViewSchema = questionSchema.omit({ upvoterIds: true }).extend({
  upvotes: z.number().int(),
  upvoted: z.boolean(),
  /** Vrai si l'utilisateur courant est l'auteur (peut supprimer sa question). */
  mine: z.boolean(),
});
export type QuestionView = z.infer<typeof questionViewSchema>;

export const askQuestionInputSchema = z.object({
  content: z.string().trim().min(5, 'Au moins 5 caractères').max(1000),
});
export type AskQuestionInput = z.input<typeof askQuestionInputSchema>;

export const answerQuestionInputSchema = z.object({
  content: z.string().trim().min(1, 'Réponse vide').max(3000),
});
export type AnswerQuestionInput = z.input<typeof answerQuestionInputSchema>;

export const questionResponseSchema = z.object({ question: questionViewSchema });
export const questionListResponseSchema = z.object({ questions: z.array(questionViewSchema) });
export type QuestionListResponse = z.infer<typeof questionListResponseSchema>;
