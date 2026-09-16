import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await usersApi.list()).users,
    enabled,
    staleTime: 15_000,
  });
}

export function useReleaseUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.release(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });
}
