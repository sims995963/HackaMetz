import type { RequestHandler } from 'express';
import { castVoteInputSchema } from '@hackametz/shared';
import type { AppContext } from '../context';

export function voteController(ctx: AppContext) {
  const hackathonOf = (req: Parameters<RequestHandler>[0]) =>
    ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);

  const summary: RequestHandler = async (req, res) => {
    res.json(await ctx.services.votes.summary(await hackathonOf(req), req.user));
  };

  const cast: RequestHandler = async (req, res) => {
    const { submissionId } = castVoteInputSchema.parse(req.body);
    res.json(await ctx.services.votes.cast(await hackathonOf(req), req.user!, submissionId));
  };

  const withdraw: RequestHandler = async (req, res) => {
    res.json(await ctx.services.votes.withdraw(await hackathonOf(req), req.user!));
  };

  return { summary, cast, withdraw };
}
