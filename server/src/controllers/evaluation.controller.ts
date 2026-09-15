import type { RequestHandler } from 'express';
import {
  evaluationInputSchema,
  setJuryInputSchema,
  type EvaluationListResponse,
  type JuryResponse,
  type ResultsResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';
import { AppError } from '../utils/errors';

export function evaluationController(ctx: AppContext) {
  const hackathonOf = (req: Parameters<RequestHandler>[0]) =>
    ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);

  /** Juré = pseudo présent dans le jury du hackathon, ou organisateur entré avec un pseudo. */
  const requireJuror = (
    req: Parameters<RequestHandler>[0],
    hackathon: Awaited<ReturnType<typeof hackathonOf>>,
  ) => {
    if (!req.user) throw AppError.unauthenticated('Entre avec ton pseudo pour noter');
    if (!req.isAdmin && !ctx.services.evaluations.isJuror(hackathon, req.user)) {
      throw AppError.forbidden('Tu ne fais pas partie du jury de ce hackathon');
    }
    return req.user;
  };

  const jury: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    const body: JuryResponse = { jury: await ctx.services.evaluations.jury(hackathon) };
    res.json(body);
  };

  const setJury: RequestHandler = async (req, res) => {
    const { pseudos } = setJuryInputSchema.parse(req.body);
    const hackathon = await hackathonOf(req);
    const updated = await ctx.services.evaluations.setJury(hackathon, pseudos);
    const body: JuryResponse = { jury: await ctx.services.evaluations.jury(updated) };
    res.json(body);
  };

  const mine: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    const juror = requireJuror(req, hackathon);
    const body: EvaluationListResponse = {
      evaluations: await ctx.services.evaluations.mine(hackathon, juror),
    };
    res.json(body);
  };

  const upsert: RequestHandler = async (req, res) => {
    const input = evaluationInputSchema.parse(req.body);
    const submission = await ctx.services.submissions.get(String(req.params.id));
    const hackathon = await ctx.repos.hackathons.findById(submission.hackathonId);
    if (!hackathon) throw AppError.notFound('Hackathon');
    const juror = requireJuror(req, hackathon);
    const evaluation = await ctx.services.evaluations.upsert(hackathon, submission, juror, input);
    res.json({ evaluation });
  };

  const forSubmission: RequestHandler = async (req, res) => {
    const submission = await ctx.services.submissions.get(String(req.params.id));
    const body: EvaluationListResponse = {
      evaluations: await ctx.services.evaluations.forSubmission(submission),
    };
    res.json(body);
  };

  const results: RequestHandler = async (req, res) => {
    const hackathon = await hackathonOf(req);
    const body: ResultsResponse = await ctx.services.evaluations.results(hackathon, req.isAdmin);
    res.json(body);
  };

  return { jury, setJury, mine, upsert, forSubmission, results };
}
