import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/api/audit.api';

/** Journal des actions d'organisateur (dashboard). */
export function useAudit(enabled: boolean, limit = 30) {
  return useQuery({
    queryKey: ['audit', limit],
    queryFn: () => auditApi.list(limit),
    enabled,
    staleTime: 10_000,
  });
}
