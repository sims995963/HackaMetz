import { Router } from 'express';
import type { AppContext } from '../context';
import { downloadController } from '../controllers/download.controller';
import { healthController, time } from '../controllers/meta.controller';
import { kbController } from '../controllers/kb.controller';
import { searchController } from '../controllers/search.controller';
import { requireAdmin } from '../middlewares/guards';
import { downloadRateLimit } from '../middlewares/rateLimit';
import { statsController } from '../controllers/stats.controller';

export function metaRoutes(ctx: AppContext) {
  const router = Router();
  const stats = statsController(ctx);
  const kb = kbController(ctx);
  const search = searchController(ctx);
  const meta = healthController(ctx);
  const downloads = downloadController(ctx);

  router.get('/health', meta.health);
  router.get('/time', time);
  router.get('/stats', stats.publicStats);
  router.get('/kb/projects', kb.projects);
  router.get('/kb/download.zip', downloadRateLimit, downloads.knowledgeBase);
  router.get('/app/source.zip', requireAdmin, downloadRateLimit, downloads.appSource);
  router.get('/search', search.search);

  return router;
}
