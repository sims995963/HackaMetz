import { Router } from 'express';
import type { AppContext } from '../context';
import { adminController } from '../controllers/admin.controller';
import { kbController } from '../controllers/kb.controller';
import { statsController } from '../controllers/stats.controller';
import { requireAdmin } from '../middlewares/guards';

export function adminRoutes(ctx: AppContext) {
  const router = Router();
  const admin = adminController(ctx);
  const stats = statsController(ctx);
  const kb = kbController(ctx);

  router.use('/admin', requireAdmin);
  router.get('/admin/stats', stats.adminStats);
  router.get('/admin/users', admin.listUsers);
  router.post('/admin/users/:id/release', admin.releaseUser);
  router.post('/admin/kb/export', kb.exportKb);

  return router;
}
