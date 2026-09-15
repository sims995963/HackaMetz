import type { CreateProposalRoundData, ProposalRound } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createProposalRound(data: CreateProposalRoundData, number: number): ProposalRound {
  return {
    id: newId(),
    number,
    title: data.title,
    description: data.description,
    status: 'draft',
    proposals: data.proposals.map((p) => ({ ...p, id: newId() })),
    winnerProposalId: null,
    hackathonId: null,
    createdAt: nowIso(),
    openedAt: null,
    closedAt: null,
  };
}
