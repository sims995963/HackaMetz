import type { RequestHandler } from 'express';
import { feedbackInputSchema, type FeedbackSummary } from '@hackametz/shared';
import type { AppContext } from '../context';

export function feedbackController(ctx: AppContext) {
  const summary: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const body: FeedbackSummary = await ctx.services.feedback.summary(
      hackathon,
      req.user,
      req.isAdmin,
    );
    res.json(body);
  };

  const upsert: RequestHandler = async (req, res) => {
    const input = feedbackInputSchema.parse(req.body);
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const feedback = await ctx.services.feedback.upsert(hackathon, req.user!, input);
    res.json({ feedback });
  };

  return { summary, upsert };
}
