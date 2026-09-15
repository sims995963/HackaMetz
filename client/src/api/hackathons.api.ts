import {
  hackathonListResponseSchema,
  hackathonResponseSchema,
  type CreateHackathonInput,
  type HackathonStatus,
  type UpdateHackathonInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const path = (slug: string) => `/hackathons/${encodeURIComponent(slug)}`;

export const hackathonsApi = {
  list: () => apiFetch('/hackathons', { schema: hackathonListResponseSchema }),
  getBySlug: (slug: string) => apiFetch(path(slug), { schema: hackathonResponseSchema }),
  create: (input: CreateHackathonInput) =>
    apiFetch('/hackathons', { method: 'POST', body: input, schema: hackathonResponseSchema }),
  update: (slug: string, input: UpdateHackathonInput) =>
    apiFetch(path(slug), { method: 'PATCH', body: input, schema: hackathonResponseSchema }),
  changeStatus: (slug: string, status: HackathonStatus) =>
    apiFetch(`${path(slug)}/status`, {
      method: 'POST',
      body: { status },
      schema: hackathonResponseSchema,
    }),
};
