import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateHackathonInput,
  HackathonStatus,
  UpdateHackathonInput,
} from '@hackametz/shared';
import { hackathonsApi } from '@/api/hackathons.api';

export const hackathonKeys = {
  all: ['hackathons'] as const,
  detail: (slug: string) => ['hackathons', slug] as const,
};

export function useHackathons() {
  return useQuery({
    queryKey: hackathonKeys.all,
    queryFn: async () => (await hackathonsApi.list()).hackathons,
    staleTime: 30_000,
  });
}

export function useHackathon(slug: string) {
  return useQuery({
    queryKey: hackathonKeys.detail(slug),
    queryFn: async () => (await hackathonsApi.getBySlug(slug)).hackathon,
    staleTime: 30_000,
    enabled: slug.length > 0,
  });
}

/** Invalide tout ce qui dépend des hackathons (liste, détail, stats). */
function useInvalidateHackathons() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: hackathonKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useCreateHackathon() {
  const invalidate = useInvalidateHackathons();
  return useMutation({
    mutationFn: (input: CreateHackathonInput) => hackathonsApi.create(input),
    onSuccess: invalidate,
  });
}

export function useUpdateHackathon(slug: string) {
  const invalidate = useInvalidateHackathons();
  return useMutation({
    mutationFn: (input: UpdateHackathonInput) => hackathonsApi.update(slug, input),
    onSuccess: invalidate,
  });
}

export function useChangeHackathonStatus() {
  const invalidate = useInvalidateHackathons();
  return useMutation({
    mutationFn: ({ slug, status }: { slug: string; status: HackathonStatus }) =>
      hackathonsApi.changeStatus(slug, status),
    onSuccess: invalidate,
  });
}
