import { votesResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

const base = (slug: string) => `/hackathons/${encodeURIComponent(slug)}`;

export const votesApi = {
  summary: (slug: string) => apiFetch(`${base(slug)}/votes`, { schema: votesResponseSchema }),
  cast: (slug: string, submissionId: string) =>
    apiFetch(`${base(slug)}/vote`, {
      method: 'PUT',
      body: { submissionId },
      schema: votesResponseSchema,
    }),
  withdraw: (slug: string) =>
    apiFetch(`${base(slug)}/vote`, { method: 'DELETE', schema: votesResponseSchema }),
};
