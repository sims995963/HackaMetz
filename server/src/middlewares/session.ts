import type { RequestHandler } from 'express';
import type { AppContext } from '../context';
import { safeEqual } from '../utils/crypto';

/**
 * Lit `Authorization: Bearer <token>` et `X-Admin-Key`, sans jamais bloquer :
 * ce sont requireUser / requireAdmin qui décident.
 */
export function session(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const adminKey = req.header('x-admin-key');
    req.isAdmin = typeof adminKey === 'string' && safeEqual(adminKey, ctx.options.adminKey);

    const auth = req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : undefined;
    if (token) req.user = await ctx.services.auth.authenticate(token);

    next();
  };
}
