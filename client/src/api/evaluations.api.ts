import {
  evaluationListResponseSchema,
  evaluationResponseSchema,
  juryResponseSchema,
  resultsResponseSchema,
  type EvaluationInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const h = (slug: string) => `/hackathons/${encodeURIComponent(slug)}`;

export const evaluationsApi = {
  jury: (slug: string) => apiFetch(`${h(slug)}/jury`, { schema: juryResponseSchema }),
  setJury: (slug: string, pseudos: string[]) =>
    apiFetch(`${h(slug)}/jury`, { method: 'PUT', body: { pseudos }, schema: juryResponseSchema }),
  mine: (slug: string) =>
    apiFetch(`${h(slug)}/evaluations/mine`, { schema: evaluationListResponseSchema }),
  upsert: (submissionId: string, input: EvaluationInput) =>
    apiFetch(`/submissions/${encodeURIComponent(submissionId)}/evaluation`, {
      method: 'PUT',
      body: input,
      schema: evaluationResponseSchema,
    }),
  results: (slug: string) => apiFetch(`${h(slug)}/results`, { schema: resultsResponseSchema }),
};
