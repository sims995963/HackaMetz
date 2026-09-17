import { Router } from 'express';
import type { AppContext } from '../context';
import { evaluationController } from '../controllers/evaluation.controller';
import { downloadController } from '../controllers/download.controller';
import { submissionController } from '../controllers/submission.controller';
import { requireAdmin, requireUser } from '../middlewares/guards';
import { downloadRateLimit } from '../middlewares/rateLimit';

export function submissionRoutes(ctx: AppContext) {
  const router = Router();
  const controller = submissionController(ctx);
  const evaluations = evaluationController(ctx);
  const downloads = downloadController(ctx);

  router.get('/submissions/:id', controller.get);
  router.get('/submissions/:id/tree', controller.tree);
  router.get('/submissions/:id/file', controller.file);
  router.get('/submissions/:id/download.zip', downloadRateLimit, downloads.project);
  router.post('/submissions/:id/status', requireAdmin, controller.setStatus);
  router.put('/submissions/:id/evaluation', requireUser, evaluations.upsert);
  router.get('/submissions/:id/evaluations', requireAdmin, evaluations.forSubmission);

  return router;
}
