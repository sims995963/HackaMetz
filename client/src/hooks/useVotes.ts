import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { VotesResponse } from '@hackametz/shared';
import { votesApi } from '@/api/votes.api';
import { useSession } from './useSession';

export function useVotes(slug: string) {
  const { token } = useSession();
  return useQuery({
    // Le token fait partie de la clé : « mon vote » dépend de qui est connecté.
    queryKey: ['votes', slug, token],
    queryFn: () => votesApi.summary(slug),
    enabled: slug.length > 0,
    staleTime: 10_000,
  });
}

/** Voter, changer de vote ou le retirer (submissionId === null). */
export function useCastVote(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string | null) =>
      submissionId ? votesApi.cast(slug, submissionId) : votesApi.withdraw(slug),
    onSuccess: (data: VotesResponse) => {
      queryClient.setQueriesData({ queryKey: ['votes', slug] }, data);
      void queryClient.invalidateQueries({ queryKey: ['results', slug] });
    },
  });
}
