import type { RequestHandler } from 'express';
import {
  answerQuestionInputSchema,
  askQuestionInputSchema,
  type QuestionListResponse,
} from '@hackametz/shared';
import type { AppContext } from '../context';

export function questionController(ctx: AppContext) {
  const list: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const body: QuestionListResponse = {
      questions: await ctx.services.questions.listFor(hackathon, req.user),
    };
    res.json(body);
  };

  const ask: RequestHandler = async (req, res) => {
    const { content } = askQuestionInputSchema.parse(req.body);
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const question = await ctx.services.questions.ask(hackathon, req.user!, content);
    res.status(201).json({ question });
  };

  const answer: RequestHandler = async (req, res) => {
    const { content } = answerQuestionInputSchema.parse(req.body);
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), true);
    const byPseudo = req.user?.pseudo ?? 'Organisateur';
    const question = await ctx.services.questions.answer(
      hackathon,
      String(req.params.id),
      content,
      byPseudo,
    );
    res.json({ question });
  };

  const remove: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    await ctx.services.questions.remove(hackathon, String(req.params.id), req.user, req.isAdmin);
    res.status(204).end();
  };

  const upvote: RequestHandler = async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);
    const question = await ctx.services.questions.setUpvote(
      hackathon,
      String(req.params.id),
      req.user!,
      req.method === 'PUT',
    );
    res.json({ question });
  };

  return { list, ask, answer, remove, upvote };
}
