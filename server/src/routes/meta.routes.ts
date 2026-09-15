import { Router } from 'express';
import type { AppContext } from '../context';
import { health, time } from '../controllers/meta.controller';
import { kbController } from '../controllers/kb.controller';
import { searchController } from '../controllers/search.controller';
import { statsController } from '../controllers/stats.controller';

export function metaRoutes(ctx: AppContext) {
  const router = Router();
  const stats = statsController(ctx);
  const kb = kbController(ctx);
  const search = searchController(ctx);

  router.get('/health', health);
  router.get('/time', time);
  router.get('/stats', stats.publicStats);
  router.get('/kb/projects', kb.projects);
  router.get('/search', search.search);

  return router;
}
