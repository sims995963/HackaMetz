import { Router } from 'express';
import type { AppContext } from '../context';
import { proposalController } from '../controllers/proposal.controller';
import { requireAdmin, requireUser } from '../middlewares/guards';

export function proposalRoutes(ctx: AppContext) {
  const router = Router();
  const c = proposalController(ctx);

  router.get('/proposals', c.list);
  router.post('/proposals', requireAdmin, c.create);
  router.get('/proposals/:id', c.get);
  router.patch('/proposals/:id', requireAdmin, c.update);
  router.post('/proposals/:id/status', requireAdmin, c.setStatus);
  router.delete('/proposals/:id', requireAdmin, c.remove);
  router.put('/proposals/:id/vote', requireUser, c.vote);
  router.delete('/proposals/:id/vote', requireUser, c.withdraw);

  return router;
}
