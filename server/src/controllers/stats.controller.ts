import type { RequestHandler } from 'express';
import type { AppContext } from '../context';

export function statsController(ctx: AppContext) {
  const publicStats: RequestHandler = async (_req, res) => {
    res.json(await ctx.services.hackathons.publicStats());
  };

  const adminStats: RequestHandler = async (_req, res) => {
    res.json(await ctx.services.hackathons.adminStats());
  };

  return { publicStats, adminStats };
}
