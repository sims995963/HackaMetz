import type { Feedback, FeedbackInput, FeedbackSummary, Hackathon } from '@hackametz/shared';
import { createFeedback } from '../models/feedback.model';
import type { UserRecord } from '../models/user.model';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';
import { nowIso } from '../utils/time';

/** Les retours s'ouvrent dès la fin des dépôts et restent possibles jusqu'à l'archivage. */
const OPEN_STATUSES = new Set(['submissions_closed', 'judging', 'finished']);

export class FeedbackService {
  constructor(private readonly repos: Repositories) {}

  isOpen(hackathon: Hackathon): boolean {
    return OPEN_STATUSES.has(hackathon.status);
  }

  async summary(
    hackathon: Hackathon,
    viewer: UserRecord | undefined,
    includeComments: boolean,
  ): Promise<FeedbackSummary> {
    const [all, participants] = await Promise.all([
      this.repos.feedback.filter((f) => f.hackathonId === hackathon.id),
      this.repos.registrations.filter((r) => r.hackathonId === hackathon.id),
    ]);
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const f of all) distribution[String(f.rating)] = (distribution[String(f.rating)] ?? 0) + 1;
    const averageRating =
      all.length === 0
        ? null
        : Math.round((all.reduce((sum, f) => sum + f.rating, 0) / all.length) * 10) / 10;
    const wouldReturnRate =
      all.length === 0
        ? null
        : Math.round((all.filter((f) => f.wouldReturn).length / all.length) * 100);
    return {
      open: this.isOpen(hackathon),
      count: all.length,
      participants: participants.length,
      averageRating,
      distribution,
      wouldReturnRate,
      mine: viewer ? (all.find((f) => f.userId === viewer.id) ?? null) : null,
      comments: includeComments
        ? all
            .slice()
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((f) => ({
              rating: f.rating,
              liked: f.liked,
              improve: f.improve,
              wouldReturn: f.wouldReturn,
              at: f.updatedAt,
            }))
        : [],
    };
  }

  /** Crée ou remplace le retour de l'utilisateur (un seul par inscrit). */
  async upsert(
    hackathon: Hackathon,
    user: UserRecord,
    input: Required<FeedbackInput>,
  ): Promise<Feedback> {
    if (!this.isOpen(hackathon)) {
      throw AppError.conflict('Les retours ne sont pas ouverts pour ce hackathon');
    }
    const registered = await this.repos.registrations.findOne(
      (r) => r.hackathonId === hackathon.id && r.userId === user.id,
    );
    if (!registered) throw AppError.forbidden('Seuls les inscrits peuvent laisser un retour');
    const existing = await this.repos.feedback.findOne(
      (f) => f.hackathonId === hackathon.id && f.userId === user.id,
    );
    if (existing) {
      return this.repos.feedback.update(existing.id, { ...input, updatedAt: nowIso() });
    }
    return this.repos.feedback.insert(createFeedback(hackathon.id, user.id, input));
  }
}
