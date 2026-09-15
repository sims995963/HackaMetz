import type { RequestHandler } from 'express';
import {
  createHackathonInputSchema,
  hackathonListQuerySchema,
  statusChangeInputSchema,
  updateHackathonInputSchema,
  type HackathonListResponse,
  type HackathonResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';

export function hackathonController(ctx: AppContext) {
  const list: RequestHandler = async (req, res) => {
    const query = hackathonListQuerySchema.parse(req.query);
    const hackathons = await ctx.services.hackathons.list({
      status: query.status,
      includeDrafts: req.isAdmin,
    });
    const body: HackathonListResponse = { hackathons };
    res.json(body);
  };

  const getBySlug: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlugWithCounts(
      String(req.params.slug),
      req.isAdmin,
    );
    const body: HackathonResponse = { hackathon };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const data = createHackathonInputSchema.parse(req.body);
    const created = await ctx.services.hackathons.create(data);
    const hackathon = await ctx.services.hackathons.getBySlugWithCounts(created.slug, true);
    const body: HackathonResponse = { hackathon };
    res.status(201).json(body);
  };

  const update: RequestHandler = async (req, res) => {
    const patch = updateHackathonInputSchema.parse(req.body);
    const updated = await ctx.services.hackathons.update(String(req.params.slug), patch);
    const hackathon = await ctx.services.hackathons.getBySlugWithCounts(updated.slug, true);
    const body: HackathonResponse = { hackathon };
    res.json(body);
  };

  const changeStatus: RequestHandler = async (req, res) => {
    const { status } = statusChangeInputSchema.parse(req.body);
    const updated = await ctx.services.hackathons.changeStatus(String(req.params.slug), status);
    const hackathon = await ctx.services.hackathons.getBySlugWithCounts(updated.slug, true);
    const body: HackathonResponse = { hackathon };
    res.json(body);
  };

  return { list, getBySlug, create, update, changeStatus };
}
