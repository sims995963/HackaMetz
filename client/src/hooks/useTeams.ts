import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/api/teams.api';
import { useSession } from './useSession';

export function useTeams(slug: string) {
  return useQuery({
    queryKey: ['teams', slug],
    queryFn: async () => (await teamsApi.list(slug)).teams,
    staleTime: 15_000,
  });
}

export function useMyTeam(slug: string) {
  const { isLoggedIn } = useSession();
  return useQuery({
    queryKey: ['teams', slug, 'mine'],
    queryFn: async () => (await teamsApi.mine(slug)).team,
    enabled: isLoggedIn,
    staleTime: 15_000,
  });
}

function useInvalidateTeams(slug: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['teams', slug] });
    void queryClient.invalidateQueries({ queryKey: ['participants', slug] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useCreateTeam(slug: string) {
  const invalidate = useInvalidateTeams(slug);
  return useMutation({
    mutationFn: (name: string) => teamsApi.create(slug, name),
    onSuccess: invalidate,
  });
}

export function useJoinTeam(slug: string) {
  const invalidate = useInvalidateTeams(slug);
  return useMutation({
    mutationFn: (code: string) => teamsApi.join(slug, code),
    onSuccess: invalidate,
  });
}

export function useLeaveTeam(slug: string) {
  const invalidate = useInvalidateTeams(slug);
  return useMutation({ mutationFn: () => teamsApi.leave(slug), onSuccess: invalidate });
}
