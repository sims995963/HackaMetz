import { z } from 'zod';
import {
  proposalRoundResponseSchema,
  proposalRoundsResponseSchema,
  type CreateProposalRoundInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const one = (id: string) => `/proposals/${encodeURIComponent(id)}`;

export const proposalsApi = {
  list: () => apiFetch('/proposals', { schema: proposalRoundsResponseSchema }),
  get: (id: string) => apiFetch(one(id), { schema: proposalRoundResponseSchema }),
  create: (input: CreateProposalRoundInput) =>
    apiFetch('/proposals', { method: 'POST', body: input, schema: proposalRoundResponseSchema }),
  update: (id: string, input: CreateProposalRoundInput) =>
    apiFetch(one(id), { method: 'PATCH', body: input, schema: proposalRoundResponseSchema }),
  setStatus: (id: string, status: 'open' | 'closed') =>
    apiFetch(`${one(id)}/status`, {
      method: 'POST',
      body: { status },
      schema: proposalRoundResponseSchema,
    }),
  remove: (id: string) => apiFetch(one(id), { method: 'DELETE', schema: z.undefined() }),
  vote: (id: string, proposalId: string) =>
    apiFetch(`${one(id)}/vote`, {
      method: 'PUT',
      body: { proposalId },
      schema: proposalRoundResponseSchema,
    }),
  withdraw: (id: string) =>
    apiFetch(`${one(id)}/vote`, { method: 'DELETE', schema: proposalRoundResponseSchema }),
};
