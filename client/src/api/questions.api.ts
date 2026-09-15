import { z } from 'zod';
import {
  questionListResponseSchema,
  questionResponseSchema,
  type AnswerQuestionInput,
  type AskQuestionInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const base = (slug: string) => `/hackathons/${encodeURIComponent(slug)}/questions`;
const one = (slug: string, id: string) => `${base(slug)}/${encodeURIComponent(id)}`;

export const questionsApi = {
  list: (slug: string) => apiFetch(base(slug), { schema: questionListResponseSchema }),
  ask: (slug: string, input: AskQuestionInput) =>
    apiFetch(base(slug), { method: 'POST', body: input, schema: questionResponseSchema }),
  answer: (slug: string, id: string, input: AnswerQuestionInput) =>
    apiFetch(`${one(slug, id)}/answer`, {
      method: 'POST',
      body: input,
      schema: questionResponseSchema,
    }),
  remove: (slug: string, id: string) =>
    apiFetch(one(slug, id), { method: 'DELETE', schema: z.undefined() }),
  setUpvote: (slug: string, id: string, upvoted: boolean) =>
    apiFetch(`${one(slug, id)}/upvote`, {
      method: upvoted ? 'PUT' : 'DELETE',
      schema: questionResponseSchema,
    }),
};
