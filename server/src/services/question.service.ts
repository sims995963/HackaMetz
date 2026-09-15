import type { Hackathon, Question, QuestionView } from '@hackametz/shared';
import { createQuestion } from '../models/question.model';
import type { UserRecord } from '../models/user.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';
import { nowIso } from '../utils/time';

/** Questions des participants à l'organisateur : une FAQ qui se construit pendant l'événement. */
export class QuestionService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  private view(question: Question, viewer: UserRecord | undefined): QuestionView {
    const { upvoterIds, ...rest } = question;
    return {
      ...rest,
      upvotes: upvoterIds.length,
      upvoted: viewer ? upvoterIds.includes(viewer.id) : false,
      mine: viewer ? question.authorId === viewer.id : false,
    };
  }

  /** Sans réponse d'abord (les plus soutenues en tête), puis les répondues de la plus récente à la plus ancienne. */
  async listFor(hackathon: Hackathon, viewer: UserRecord | undefined): Promise<QuestionView[]> {
    const all = await this.repos.questions.filter((q) => q.hackathonId === hackathon.id);
    all.sort((a, b) => {
      const aAnswered = a.answer !== null;
      const bAnswered = b.answer !== null;
      if (aAnswered !== bAnswered) return aAnswered ? 1 : -1;
      if (!aAnswered && a.upvoterIds.length !== b.upvoterIds.length) {
        return b.upvoterIds.length - a.upvoterIds.length;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
    return all.map((q) => this.view(q, viewer));
  }

  private async getOwned(hackathon: Hackathon, id: string): Promise<Question> {
    const question = await this.repos.questions.findById(id);
    if (!question || question.hackathonId !== hackathon.id) throw AppError.notFound('Question');
    return question;
  }

  async ask(hackathon: Hackathon, author: UserRecord, content: string): Promise<QuestionView> {
    if (hackathon.status === 'archived') {
      throw AppError.conflict('Ce hackathon est archivé : les questions sont fermées');
    }
    const question = await this.repos.questions.insert(
      createQuestion(hackathon.id, author, content),
    );
    this.events.emit('question', hackathon.slug, `Nouvelle question de ${author.pseudo}`);
    return this.view(question, author);
  }

  async answer(
    hackathon: Hackathon,
    id: string,
    content: string,
    byPseudo: string,
  ): Promise<QuestionView> {
    await this.getOwned(hackathon, id);
    const updated = await this.repos.questions.update(id, {
      answer: { content, byPseudo, at: nowIso() },
    });
    this.events.emit(
      'question',
      hackathon.slug,
      `L’organisateur a répondu à ${updated.authorPseudo}`,
    );
    return this.view(updated, undefined);
  }

  /** L'auteur peut retirer sa question tant qu'elle n'a pas de réponse ; l'organisateur toujours. */
  async remove(hackathon: Hackathon, id: string, by: UserRecord | undefined, isAdmin: boolean) {
    const question = await this.getOwned(hackathon, id);
    const isAuthor = by !== undefined && question.authorId === by.id;
    if (!isAdmin && !isAuthor) throw AppError.forbidden('Cette question n’est pas la tienne');
    if (!isAdmin && question.answer) {
      throw AppError.conflict('Une question déjà répondue ne peut plus être retirée');
    }
    await this.repos.questions.remove(id);
  }

  async setUpvote(
    hackathon: Hackathon,
    id: string,
    user: UserRecord,
    upvoted: boolean,
  ): Promise<QuestionView> {
    await this.getOwned(hackathon, id);
    const updated = await this.repos.questions.update(id, (current) => ({
      ...current,
      upvoterIds: upvoted
        ? Array.from(new Set([...current.upvoterIds, user.id]))
        : current.upvoterIds.filter((uid) => uid !== user.id),
    }));
    return this.view(updated, user);
  }
}
