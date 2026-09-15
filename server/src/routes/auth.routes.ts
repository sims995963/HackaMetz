import { Router } from 'express';
import type { AppContext } from '../context';
import { authController } from '../controllers/auth.controller';
import { requireUser } from '../middlewares/guards';
import { enterRateLimit } from '../middlewares/rateLimit';

export function authRoutes(ctx: AppContext) {
  const router = Router();
  const controller = authController(ctx);

  router.post('/auth/enter', enterRateLimit, controller.enter);
  router.get('/me', requireUser, controller.me);

  return router;
}
