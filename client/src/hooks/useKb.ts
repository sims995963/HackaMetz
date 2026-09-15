import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kbApi, type KbFilters } from '@/api/kb.api';

export function useKbProjects(filters: KbFilters) {
  return useQuery({
    queryKey: ['kb', 'projects', filters],
    queryFn: () => kbApi.projects(filters),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });
}

export function useKbExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commit: boolean) => kbApi.export(commit),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['kb'] }),
  });
}
