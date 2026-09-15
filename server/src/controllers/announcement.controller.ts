import type { RequestHandler } from 'express';
import { createAnnouncementInputSchema, type AnnouncementListResponse } from '@hackametz/shared';
import type { AppContext } from '../context';

export function announcementController(ctx: AppContext) {
  const list: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const body: AnnouncementListResponse = {
      announcements: await ctx.services.announcements.listFor(hackathon.id),
    };
    res.json(body);
  };

  const create: RequestHandler = async (req, res) => {
    const input = createAnnouncementInputSchema.parse(req.body);
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), true);
    const announcement = await ctx.services.announcements.create(hackathon, input);
    res.status(201).json({ announcement });
  };

  const remove: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), true);
    await ctx.services.announcements.remove(hackathon, String(req.params.id));
    res.status(204).end();
  };

  return { list, create, remove };
}
