import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JoinInput } from '@hackametz/shared';
import { registrationsApi } from '@/api/registrations.api';
import { submissionsApi } from '@/api/submissions.api';
import { hackathonKeys } from './useHackathons';

export function useParticipants(slug: string) {
  return useQuery({
    queryKey: ['participants', slug],
    queryFn: async () => (await registrationsApi.participants(slug)).participants,
    staleTime: 15_000,
  });
}

export function useSubmissions(slug: string) {
  return useQuery({
    queryKey: ['submissions', slug],
    queryFn: async () => (await submissionsApi.listForHackathon(slug)).submissions,
    staleTime: 15_000,
  });
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ['submission', id],
    queryFn: async () => (await submissionsApi.get(id)).submission,
    enabled: id.length > 0,
  });
}

export function useSubmissionTree(id: string) {
  return useQuery({
    queryKey: ['submission', id, 'tree'],
    queryFn: () => submissionsApi.tree(id),
    enabled: id.length > 0,
    staleTime: 60_000,
  });
}

export function useSubmissionFile(id: string, path: string | null) {
  return useQuery({
    queryKey: ['submission', id, 'file', path],
    queryFn: () => submissionsApi.file(id, path!),
    enabled: path !== null,
    staleTime: 60_000,
  });
}

function useInvalidateParticipation(slug: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['participants', slug] });
    void queryClient.invalidateQueries({ queryKey: ['submissions', slug] });
    void queryClient.invalidateQueries({ queryKey: hackathonKeys.detail(slug) });
    void queryClient.invalidateQueries({ queryKey: hackathonKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
  };
}

export function useJoinHackathon(slug: string) {
  const invalidate = useInvalidateParticipation(slug);
  return useMutation({
    mutationFn: (input: JoinInput) => registrationsApi.join(slug, input),
    onSuccess: invalidate,
  });
}

export function useLeaveHackathon(slug: string) {
  const invalidate = useInvalidateParticipation(slug);
  return useMutation({
    mutationFn: () => registrationsApi.leave(slug),
    onSuccess: invalidate,
  });
}

export function useInvalidateAfterSubmit(slug: string) {
  return useInvalidateParticipation(slug);
}
