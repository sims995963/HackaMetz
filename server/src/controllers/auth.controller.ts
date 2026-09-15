import type { RequestHandler } from 'express';
import { enterInputSchema, type EnterResponse, type MeDetailsResponse } from '@hackametz/shared';
import type { AppContext } from '../context';

/** Les contrôleurs ne font que : valider l'entrée → appeler un service → répondre. */
export function authController(ctx: AppContext) {
  const enter: RequestHandler = async (req, res) => {
    const { pseudo } = enterInputSchema.parse(req.body);
    const auth = req.header('authorization');
    const presentedToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
    const result: EnterResponse = await ctx.services.auth.enter(pseudo, presentedToken);
    res.status(result.created ? 201 : 200).json(result);
  };

  const me: RequestHandler = async (req, res) => {
    // requireUser garantit req.user
    const body: MeDetailsResponse = await ctx.services.profile.details(req.user!);
    res.json(body);
  };

  return { enter, me };
}
