import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateAnnouncementInput } from '@hackametz/shared';
import { announcementsApi } from '@/api/announcements.api';

export function useAnnouncements(slug: string) {
  return useQuery({
    queryKey: ['announcements', slug],
    queryFn: async () => (await announcementsApi.list(slug)).announcements,
    staleTime: 15_000,
  });
}

export function useCreateAnnouncement(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementsApi.create(slug, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['announcements', slug] }),
  });
}

export function useRemoveAnnouncement(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.remove(slug, id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['announcements', slug] }),
  });
}
