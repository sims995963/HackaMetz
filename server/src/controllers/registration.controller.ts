import type { RequestHandler } from 'express';
import {
  joinInputSchema,
  type ParticipantsResponse,
  type RegistrationResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';

export function registrationController(ctx: AppContext) {
  const join: RequestHandler = async (req, res) => {
    const input = joinInputSchema.parse(req.body ?? {});
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const registration = await ctx.services.registrations.join(hackathon, req.user!, input);
    const body: RegistrationResponse = { registration };
    res.status(201).json(body);
  };

  const leave: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    await ctx.services.registrations.leave(hackathon, req.user!);
    res.status(204).end();
  };

  const participants: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const body: ParticipantsResponse = {
      participants: await ctx.services.registrations.participants(hackathon.id),
    };
    res.json(body);
  };

  return { join, leave, participants };
}
