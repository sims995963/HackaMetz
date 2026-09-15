import { z } from 'zod';
import { teamMineSchema, teamResponseSchema, teamsResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

const base = (slug: string) => `/hackathons/${encodeURIComponent(slug)}/teams`;

export const teamsApi = {
  list: (slug: string) => apiFetch(base(slug), { schema: teamsResponseSchema }),
  mine: (slug: string) =>
    apiFetch(`${base(slug)}/mine`, { schema: z.object({ team: teamMineSchema.nullable() }) }),
  create: (slug: string, name: string) =>
    apiFetch(base(slug), { method: 'POST', body: { name }, schema: teamResponseSchema }),
  join: (slug: string, inviteCode: string) =>
    apiFetch(`${base(slug)}/join`, {
      method: 'POST',
      body: { inviteCode },
      schema: teamResponseSchema,
    }),
  leave: (slug: string) =>
    apiFetch(`${base(slug)}/mine`, { method: 'DELETE', schema: z.undefined() }),
};
