import { useQuery } from '@tanstack/react-query';
import { statsApi } from '@/api/stats.api';

export function usePublicStats() {
  return useQuery({
    queryKey: ['stats', 'public'],
    queryFn: () => statsApi.public(),
    staleTime: 60_000,
  });
}

export function useAdminStats(enabled: boolean) {
  return useQuery({
    queryKey: ['stats', 'admin'],
    queryFn: () => statsApi.admin(),
    enabled,
    staleTime: 15_000,
    retry: false,
  });
}
