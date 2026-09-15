import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedbackInput } from '@hackametz/shared';
import { feedbackApi } from '@/api/feedback.api';
import { useSession } from './useSession';

export function useFeedbackSummary(slug: string, enabled = true) {
  const { user, isAdmin } = useSession();
  return useQuery({
    queryKey: ['feedback', slug, user?.id ?? 'anon', isAdmin],
    queryFn: () => feedbackApi.summary(slug),
    enabled,
    staleTime: 30_000,
  });
}

export function useSendFeedback(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedbackInput) => feedbackApi.upsert(slug, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feedback', slug] }),
  });
}
