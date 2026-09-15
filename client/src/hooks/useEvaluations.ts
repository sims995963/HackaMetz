import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EvaluationInput } from '@hackametz/shared';
import { evaluationsApi } from '@/api/evaluations.api';
import { useSession } from './useSession';

export function useJury(slug: string) {
  return useQuery({
    queryKey: ['jury', slug],
    queryFn: async () => (await evaluationsApi.jury(slug)).jury,
    enabled: slug.length > 0,
    staleTime: 30_000,
  });
}

export function useSetJury(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pseudos: string[]) => evaluationsApi.setJury(slug, pseudos),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['jury', slug] }),
  });
}

/** Vrai si l'utilisateur courant peut noter : membre du jury, ou organisateur entré avec un pseudo. */
export function useIsJuror(slug: string): boolean {
  const { user, isAdmin } = useSession();
  const { data: jury } = useJury(slug);
  if (!user) return false;
  return isAdmin || (jury?.some((j) => j.id === user.id) ?? false);
}

export function useMyEvaluations(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['evaluations', slug, 'mine'],
    queryFn: async () => (await evaluationsApi.mine(slug)).evaluations,
    enabled,
    staleTime: 10_000,
  });
}

export function useUpsertEvaluation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, input }: { submissionId: string; input: EvaluationInput }) =>
      evaluationsApi.upsert(submissionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['evaluations', slug] });
      void queryClient.invalidateQueries({ queryKey: ['results', slug] });
    },
  });
}

export function useResults(slug: string) {
  return useQuery({
    queryKey: ['results', slug],
    queryFn: () => evaluationsApi.results(slug),
    enabled: slug.length > 0,
    staleTime: 15_000,
  });
}
