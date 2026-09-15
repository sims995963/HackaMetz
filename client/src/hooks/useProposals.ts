import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProposalRoundInput } from '@hackametz/shared';
import { proposalsApi } from '@/api/proposals.api';
import { useSession } from './useSession';

export function useProposalRounds() {
  const { token, isAdmin } = useSession();
  return useQuery({
    // Le token et la clé admin font partie de la clé : « mon vote » et les brouillons en dépendent.
    queryKey: ['proposals', token, isAdmin],
    queryFn: async () => (await proposalsApi.list()).rounds,
    staleTime: 15_000,
  });
}

export function useProposalRound(id: string) {
  const { token, isAdmin } = useSession();
  return useQuery({
    queryKey: ['proposals', id, token, isAdmin],
    queryFn: async () => (await proposalsApi.get(id)).round,
    enabled: id.length > 0,
  });
}

function useInvalidateProposals() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['proposals'] });
}

export function useProposalVote() {
  const invalidate = useInvalidateProposals();
  return useMutation({
    mutationFn: ({ roundId, proposalId }: { roundId: string; proposalId: string | null }) =>
      proposalId ? proposalsApi.vote(roundId, proposalId) : proposalsApi.withdraw(roundId),
    onSuccess: invalidate,
  });
}

export function useProposalAdmin() {
  const invalidate = useInvalidateProposals();
  const create = useMutation({
    mutationFn: (input: CreateProposalRoundInput) => proposalsApi.create(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateProposalRoundInput }) =>
      proposalsApi.update(id, input),
    onSuccess: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'closed' }) =>
      proposalsApi.setStatus(id, status),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => proposalsApi.remove(id),
    onSuccess: invalidate,
  });
  return { create, update, setStatus, remove };
}
