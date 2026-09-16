import { Router } from 'express';
import type { AppContext } from '../context';
import { adminController, auditController } from '../controllers/admin.controller';
import { kbController } from '../controllers/kb.controller';
import { statsController } from '../controllers/stats.controller';
import { requireAdmin } from '../middlewares/guards';

export function adminRoutes(ctx: AppContext) {
  const router = Router();
  const admin = adminController(ctx);
  const stats = statsController(ctx);
  const kb = kbController(ctx);
  const audit = auditController(ctx);

  router.use('/admin', requireAdmin);
  router.get('/admin/stats', stats.adminStats);
  router.get('/admin/users', admin.listUsers);
  router.post('/admin/users/:id/release', admin.releaseUser);
  router.post('/admin/kb/export', kb.exportKb);
  router.get('/admin/audit', audit.list);

  return router;
}
