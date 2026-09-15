import type { RequestHandler } from 'express';
import { z } from 'zod';
import { kbExportInputSchema, type KbProjectsResponse } from '@hackametz/shared';
import type { AppContext } from '../context';

const querySchema = z.object({
  q: z.string().max(100).optional(),
  tech: z.string().max(50).optional(),
  hackathon: z.string().max(100).optional(),
});

export function kbController(ctx: AppContext) {
  const projects: RequestHandler = async (req, res) => {
    const query = querySchema.parse(req.query);
    const body: KbProjectsResponse = await ctx.services.kb.projects(query, req.isAdmin);
    res.json(body);
  };

  const exportKb: RequestHandler = async (req, res) => {
    const { commit } = kbExportInputSchema.parse(req.body ?? {});
    res.json(await ctx.services.kb.export({ commit }));
  };

  return { projects, exportKb };
}
