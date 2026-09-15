import type { RequestHandler } from 'express';
import { z } from 'zod';
import {
  submissionMetaSchema,
  type Hackathon,
  type SubmissionListResponse,
  type SubmissionResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';
import { AppError } from '../utils/errors';

const fileQuerySchema = z.object({ path: z.string().min(1) });
const statusBodySchema = z.object({ status: z.enum(['submitted', 'late', 'disqualified']) });

export function submissionController(ctx: AppContext) {
  /** Multipart : `archive` (zip) + `meta` (JSON). Le hackathon a été résolu par le middleware d'upload. */
  const submit: RequestHandler = async (req, res) => {
    const hackathon = res.locals.hackathon as Hackathon;
    if (!req.file)
      throw new AppError(400, 'VALIDATION_ERROR', 'Archive manquante (champ « archive »)');

    let rawMeta: unknown;
    try {
      rawMeta = JSON.parse(String(req.body?.meta ?? '{}'));
    } catch {
      throw new AppError(400, 'VALIDATION_ERROR', 'Métadonnées illisibles (champ « meta »)');
    }
    const meta = submissionMetaSchema.parse(rawMeta);

    const submission = await ctx.services.submissions.submit({
      hackathon,
      user: req.user!,
      meta,
      archive: { path: req.file.path, size: req.file.size, originalName: req.file.originalname },
    });
    const body: SubmissionResponse = { submission };
    res.status(201).json(body);
  };

  const listForHackathon: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const body: SubmissionListResponse = {
      submissions: await ctx.services.submissions.listFor(hackathon.id),
    };
    res.json(body);
  };

  const get: RequestHandler = async (req, res) => {
    const body: SubmissionResponse = {
      submission: await ctx.services.submissions.get(String(req.params.id)),
    };
    res.json(body);
  };

  const tree: RequestHandler = async (req, res) => {
    res.json(await ctx.services.submissions.tree(String(req.params.id)));
  };

  const file: RequestHandler = async (req, res) => {
    const { path } = fileQuerySchema.parse(req.query);
    res.json(await ctx.services.submissions.file(String(req.params.id), path));
  };

  const setStatus: RequestHandler = async (req, res) => {
    const { status } = statusBodySchema.parse(req.body);
    const body: SubmissionResponse = {
      submission: await ctx.services.submissions.updateStatus(String(req.params.id), status),
    };
    res.json(body);
  };

  return { submit, listForHackathon, get, tree, file, setStatus };
}
