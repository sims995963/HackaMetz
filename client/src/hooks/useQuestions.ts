import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerQuestionInput, AskQuestionInput } from '@hackametz/shared';
import { questionsApi } from '@/api/questions.api';
import { useSession } from './useSession';

export const questionKeys = { list: (slug: string) => ['questions', slug] as const };

export function useQuestions(slug: string) {
  const { user } = useSession();
  return useQuery({
    // L'identité change « mine » / « upvoted » : on recharge quand on change de pseudo.
    queryKey: [...questionKeys.list(slug), user?.id ?? 'anon'],
    queryFn: async () => (await questionsApi.list(slug)).questions,
    staleTime: 15_000,
  });
}

function useInvalidate(slug: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: questionKeys.list(slug) });
}

export function useAskQuestion(slug: string) {
  const invalidate = useInvalidate(slug);
  return useMutation({
    mutationFn: (input: AskQuestionInput) => questionsApi.ask(slug, input),
    onSuccess: invalidate,
  });
}

export function useAnswerQuestion(slug: string) {
  const invalidate = useInvalidate(slug);
  return useMutation({
    mutationFn: ({ id, ...input }: AnswerQuestionInput & { id: string }) =>
      questionsApi.answer(slug, id, input),
    onSuccess: invalidate,
  });
}

export function useRemoveQuestion(slug: string) {
  const invalidate = useInvalidate(slug);
  return useMutation({
    mutationFn: (id: string) => questionsApi.remove(slug, id),
    onSuccess: invalidate,
  });
}

export function useUpvoteQuestion(slug: string) {
  const invalidate = useInvalidate(slug);
  return useMutation({
    mutationFn: ({ id, upvoted }: { id: string; upvoted: boolean }) =>
      questionsApi.setUpvote(slug, id, upvoted),
    onSuccess: invalidate,
  });
}
