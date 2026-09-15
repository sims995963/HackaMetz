import {
  feedbackResponseSchema,
  feedbackSummarySchema,
  type FeedbackInput,
} from '@hackametz/shared';
import { apiFetch } from './client';

const base = (slug: string) => `/hackathons/${encodeURIComponent(slug)}/feedback`;

export const feedbackApi = {
  summary: (slug: string) => apiFetch(base(slug), { schema: feedbackSummarySchema }),
  upsert: (slug: string, input: FeedbackInput) =>
    apiFetch(base(slug), { method: 'PUT', body: input, schema: feedbackResponseSchema }),
};
