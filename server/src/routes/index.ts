import { Router } from 'express';
import type { AppContext } from '../context';
import { adminRoutes } from './admin.routes';
import { authRoutes } from './auth.routes';
import { hackathonRoutes } from './hackathon.routes';
import { metaRoutes } from './meta.routes';
import { proposalRoutes } from './proposal.routes';
import { submissionRoutes } from './submission.routes';

/** Toutes les routes de l'API, montées sous /api par app.ts. */
export function apiRouter(ctx: AppContext) {
  const router = Router();

  router.use(metaRoutes(ctx));
  router.use(authRoutes(ctx));
  router.use(hackathonRoutes(ctx));
  router.use(submissionRoutes(ctx));
  router.use(proposalRoutes(ctx));
  router.use(adminRoutes(ctx));

  return router;
}
