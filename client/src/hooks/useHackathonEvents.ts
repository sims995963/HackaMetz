import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hackathonEventSchema, type HackathonEventType } from '@hackametz/shared';
import { toast } from 'sonner';
import { hackathonKeys } from './useHackathons';

const TYPES: HackathonEventType[] = [
  'announcement',
  'registration',
  'submission',
  'status',
  'team',
  'question',
];

/**
 * Abonne la page d'un hackathon à son flux SSE : les données concernées sont rechargées
 * et les annonces / changements de statut sont signalés par un toast.
 */
export function useHackathonEvents(slug: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!slug) return;
    const source = new EventSource(`/api/hackathons/${encodeURIComponent(slug)}/events`);

    const handlers = TYPES.map((type) => {
      const handler = (raw: MessageEvent) => {
        const parsed = hackathonEventSchema.safeParse(JSON.parse(String(raw.data)));
        if (!parsed.success) return;
        const event = parsed.data;
        switch (event.type) {
          case 'announcement':
            void queryClient.invalidateQueries({ queryKey: ['announcements', slug] });
            toast.info(event.message, { duration: 8000 });
            break;
          case 'status':
            void queryClient.invalidateQueries({ queryKey: hackathonKeys.detail(slug) });
            void queryClient.invalidateQueries({ queryKey: hackathonKeys.all });
            toast.info(event.message);
            break;
          case 'registration':
          case 'team':
            void queryClient.invalidateQueries({ queryKey: ['participants', slug] });
            void queryClient.invalidateQueries({ queryKey: ['teams', slug] });
            void queryClient.invalidateQueries({ queryKey: hackathonKeys.detail(slug) });
            break;
          case 'question':
            void queryClient.invalidateQueries({ queryKey: ['questions', slug] });
            toast(event.message);
            break;
          case 'submission':
            void queryClient.invalidateQueries({ queryKey: ['submissions', slug] });
            void queryClient.invalidateQueries({ queryKey: hackathonKeys.detail(slug) });
            toast(event.message);
            break;
        }
      };
      source.addEventListener(type, handler);
      return { type, handler };
    });

    return () => {
      for (const { type, handler } of handlers) source.removeEventListener(type, handler);
      source.close();
    };
  }, [slug, queryClient]);
}
