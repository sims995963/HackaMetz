import type { RequestHandler } from 'express';
import {
  createProposalRoundInputSchema,
  proposalRoundStatusInputSchema,
  proposalVoteInputSchema,
} from '@hackametz/shared';
import type { AppContext } from '../context';

export function proposalController(ctx: AppContext) {
  const list: RequestHandler = async (req, res) => {
    res.json({ rounds: await ctx.services.proposals.list(req.user, req.isAdmin) });
  };

  const get: RequestHandler = async (req, res) => {
    res.json({
      round: await ctx.services.proposals.get(String(req.params.id), req.user, req.isAdmin),
    });
  };

  const create: RequestHandler = async (req, res) => {
    const data = createProposalRoundInputSchema.parse(req.body);
    const round = await ctx.services.proposals.create(data);
    res.status(201).json({ round: await ctx.services.proposals.get(round.id, req.user, true) });
  };

  const update: RequestHandler = async (req, res) => {
    const data = createProposalRoundInputSchema.parse(req.body);
    const round = await ctx.services.proposals.update(String(req.params.id), data);
    res.json({ round: await ctx.services.proposals.get(round.id, req.user, true) });
  };

  const setStatus: RequestHandler = async (req, res) => {
    const { status } = proposalRoundStatusInputSchema.parse(req.body);
    const id = String(req.params.id);
    const round =
      status === 'open'
        ? await ctx.services.proposals.open(id)
        : await ctx.services.proposals.close(id);
    res.json({ round: await ctx.services.proposals.get(round.id, req.user, true) });
  };

  const remove: RequestHandler = async (req, res) => {
    await ctx.services.proposals.remove(String(req.params.id));
    res.status(204).end();
  };

  const vote: RequestHandler = async (req, res) => {
    const { proposalId } = proposalVoteInputSchema.parse(req.body);
    res.json({
      round: await ctx.services.proposals.vote(String(req.params.id), req.user!, proposalId),
    });
  };

  const withdraw: RequestHandler = async (req, res) => {
    res.json({ round: await ctx.services.proposals.withdraw(String(req.params.id), req.user!) });
  };

  return { list, get, create, update, setStatus, remove, vote, withdraw };
}
