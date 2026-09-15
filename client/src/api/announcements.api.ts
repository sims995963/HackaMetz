import { z } from 'zod';
import {
  announcementListResponseSchema,
  announcementResponseSchema,
  type CreateAnnouncementInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const base = (slug: string) => `/hackathons/${encodeURIComponent(slug)}/announcements`;

export const announcementsApi = {
  list: (slug: string) => apiFetch(base(slug), { schema: announcementListResponseSchema }),
  create: (slug: string, input: CreateAnnouncementInput) =>
    apiFetch(base(slug), { method: 'POST', body: input, schema: announcementResponseSchema }),
  remove: (slug: string, id: string) =>
    apiFetch(`${base(slug)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      schema: z.undefined(),
    }),
};
