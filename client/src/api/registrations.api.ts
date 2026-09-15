import { z } from 'zod';
import {
  participantsResponseSchema,
  registrationResponseSchema,
  type JoinInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

export const registrationsApi = {
  join: (slug: string, input: JoinInput) =>
    apiFetch(`/hackathons/${encodeURIComponent(slug)}/registration`, {
      method: 'POST',
      body: input,
      schema: registrationResponseSchema,
    }),
  leave: (slug: string) =>
    apiFetch(`/hackathons/${encodeURIComponent(slug)}/registration`, {
      method: 'DELETE',
      schema: z.undefined(),
    }),
  participants: (slug: string) =>
    apiFetch(`/hackathons/${encodeURIComponent(slug)}/participants`, {
      schema: participantsResponseSchema,
    }),
};
