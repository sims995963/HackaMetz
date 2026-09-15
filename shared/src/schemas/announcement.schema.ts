import { z } from 'zod';

export const announcementSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  title: z.string().min(1).max(120),
  /** Markdown. */
  content: z.string().max(5000),
  pinned: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Announcement = z.infer<typeof announcementSchema>;

export const createAnnouncementInputSchema = z.object({
  title: z.string().trim().min(1, 'Titre requis').max(120),
  content: z.string().max(5000).default(''),
  pinned: z.boolean().default(false),
});
export type CreateAnnouncementInput = z.input<typeof createAnnouncementInputSchema>;

export const announcementResponseSchema = z.object({ announcement: announcementSchema });
export const announcementListResponseSchema = z.object({
  announcements: z.array(announcementSchema),
});
export type AnnouncementListResponse = z.infer<typeof announcementListResponseSchema>;

/** Événements poussés en temps réel (SSE) sur la page d'un hackathon. */
export const HACKATHON_EVENT_TYPES = [
  'announcement',
  'registration',
  'submission',
  'status',
  'team',
  'question',
] as const;
export type HackathonEventType = (typeof HACKATHON_EVENT_TYPES)[number];

export const hackathonEventSchema = z.object({
  type: z.enum(HACKATHON_EVENT_TYPES),
  hackathonSlug: z.string(),
  at: z.iso.datetime(),
  /** Phrase prête à afficher (toast). */
  message: z.string(),
});
export type HackathonEvent = z.infer<typeof hackathonEventSchema>;
