import { Router } from 'express';
import type { AppContext } from '../context';
import { announcementController } from '../controllers/announcement.controller';
import { downloadController } from '../controllers/download.controller';
import { evaluationController } from '../controllers/evaluation.controller';
import { exportController } from '../controllers/export.controller';
import { feedbackController } from '../controllers/feedback.controller';
import { hackathonController } from '../controllers/hackathon.controller';
import { questionController } from '../controllers/question.controller';
import { registrationController } from '../controllers/registration.controller';
import { submissionController } from '../controllers/submission.controller';
import { teamController } from '../controllers/team.controller';
import { voteController } from '../controllers/vote.controller';
import { requireAdmin, requireUser } from '../middlewares/guards';
import { downloadRateLimit, uploadRateLimit, writeRateLimit } from '../middlewares/rateLimit';
import { uploadArchive } from '../middlewares/upload';
import { hackathonEvents } from '../realtime/sse';

export function hackathonRoutes(ctx: AppContext) {
  const router = Router();
  const hackathons = hackathonController(ctx);
  const registrations = registrationController(ctx);
  const submissions = submissionController(ctx);
  const teams = teamController(ctx);
  const announcements = announcementController(ctx);
  const evaluations = evaluationController(ctx);
  const votes = voteController(ctx);
  const questions = questionController(ctx);
  const feedback = feedbackController(ctx);
  const exports = exportController(ctx);
  const downloads = downloadController(ctx);

  router.get('/hackathons', hackathons.list);
  router.post('/hackathons', requireAdmin, hackathons.create);
  router.get('/hackathons/:slug', hackathons.getBySlug);
  router.patch('/hackathons/:slug', requireAdmin, hackathons.update);
  router.post('/hackathons/:slug/status', requireAdmin, hackathons.changeStatus);
  router.get('/hackathons/:slug/events', hackathonEvents(ctx));

  router.get('/hackathons/:slug/participants', registrations.participants);
  router.post('/hackathons/:slug/registration', writeRateLimit, requireUser, registrations.join);
  router.delete('/hackathons/:slug/registration', requireUser, registrations.leave);

  router.get('/hackathons/:slug/teams', teams.list);
  router.get('/hackathons/:slug/teams/mine', requireUser, teams.mine);
  router.post('/hackathons/:slug/teams', writeRateLimit, requireUser, teams.create);
  router.post('/hackathons/:slug/teams/join', writeRateLimit, requireUser, teams.join);
  router.delete('/hackathons/:slug/teams/mine', requireUser, teams.leave);

  router.get('/hackathons/:slug/submissions', submissions.listForHackathon);
  router.post(
    '/hackathons/:slug/submissions',
    uploadRateLimit,
    requireUser,
    uploadArchive(ctx),
    submissions.submit,
  );

  router.get('/hackathons/:slug/jury', evaluations.jury);
  router.put('/hackathons/:slug/jury', requireAdmin, evaluations.setJury);
  router.get('/hackathons/:slug/evaluations/mine', requireUser, evaluations.mine);
  router.get('/hackathons/:slug/results', evaluations.results);
  router.get('/hackathons/:slug/votes', votes.summary);
  router.put('/hackathons/:slug/vote', writeRateLimit, requireUser, votes.cast);
  router.delete('/hackathons/:slug/vote', requireUser, votes.withdraw);

  router.get('/hackathons/:slug/announcements', announcements.list);
  router.post('/hackathons/:slug/announcements', requireAdmin, announcements.create);
  router.delete('/hackathons/:slug/announcements/:id', requireAdmin, announcements.remove);

  router.get('/hackathons/:slug/questions', questions.list);
  router.post('/hackathons/:slug/questions', writeRateLimit, requireUser, questions.ask);
  router.post('/hackathons/:slug/questions/:id/answer', requireAdmin, questions.answer);
  router.delete('/hackathons/:slug/questions/:id', requireUser, questions.remove);
  router.put(
    '/hackathons/:slug/questions/:id/upvote',
    writeRateLimit,
    requireUser,
    questions.upvote,
  );
  router.delete('/hackathons/:slug/questions/:id/upvote', requireUser, questions.upvote);

  router.get('/hackathons/:slug/exports/:kind.csv', requireAdmin, exports.csv);
  router.get('/hackathons/:slug/download.zip', downloadRateLimit, downloads.edition);

  router.get('/hackathons/:slug/feedback', feedback.summary);
  router.put('/hackathons/:slug/feedback', writeRateLimit, requireUser, feedback.upsert);

  return router;
}
