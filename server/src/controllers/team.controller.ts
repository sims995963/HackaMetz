import type { RequestHandler } from 'express';
import {
  createTeamInputSchema,
  joinTeamInputSchema,
  type TeamResponse,
  type TeamsResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';

export function teamController(ctx: AppContext) {
  const hackathonOf = (req: Parameters<RequestHandler>[0]) =>
    ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);

  const list: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    const body: TeamsResponse = { teams: await ctx.services.teams.listPublic(hackathon.id) };
    res.json(body);
  };

  const mine: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    res.json({ team: await ctx.services.teams.mine(hackathon.id, req.user!.id) });
  };

  const create: RequestHandler = async (req, res) => {
    const { name } = createTeamInputSchema.parse(req.body);
    const hackathon = await hackathonOf(req);
    const body: TeamResponse = {
      team: await ctx.services.teams.create(hackathon, req.user!, name),
    };
    res.status(201).json(body);
  };

  const join: RequestHandler = async (req, res) => {
    const { inviteCode } = joinTeamInputSchema.parse(req.body);
    const hackathon = await hackathonOf(req);
    const body: TeamResponse = {
      team: await ctx.services.teams.join(hackathon, req.user!, inviteCode),
    };
    res.json(body);
  };

  const leave: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    await ctx.services.teams.leave(hackathon, req.user!);
    res.status(204).end();
  };

  return { list, mine, create, join, leave };
}
