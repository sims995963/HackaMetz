import type { Hackathon, VotesResponse } from '@hackametz/shared';
import type { UserRecord } from '../models/user.model';
import { createVote } from '../models/vote.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';

const OPEN_STATUSES = new Set(['running', 'submissions_closed', 'judging']);

/**
 * Coup de cœur du public : un vote par inscrit, jamais pour son propre projet,
 * modifiable tant que le hackathon est en cours ou en délibération.
 */
export class VoteService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  isOpen(hackathon: Hackathon): boolean {
    return (hackathon.publicVote ?? false) && OPEN_STATUSES.has(hackathon.status);
  }

  async summary(hackathon: Hackathon, user: UserRecord | undefined): Promise<VotesResponse> {
    const votes = await this.repos.votes.filter((v) => v.hackathonId === hackathon.id);
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.submissionId] = (counts[v.submissionId] ?? 0) + 1;
    return {
      open: this.isOpen(hackathon),
      total: votes.length,
      counts,
      mine: user ? (votes.find((v) => v.userId === user.id)?.submissionId ?? null) : null,
    };
  }

  async cast(hackathon: Hackathon, user: UserRecord, submissionId: string): Promise<VotesResponse> {
    if (!(hackathon.publicVote ?? false)) {
      throw AppError.conflict('Le vote du public est désactivé pour ce hackathon');
    }
    if (!this.isOpen(hackathon)) throw AppError.conflict('Le vote du public est fermé');
    const registered = await this.repos.registrations.findOne(
      (r) => r.hackathonId === hackathon.id && r.userId === user.id,
    );
    if (!registered) throw AppError.forbidden('Seuls les inscrits au hackathon peuvent voter');

    const submission = await this.repos.submissions.findById(submissionId);
    if (!submission || submission.hackathonId !== hackathon.id) throw AppError.notFound('Projet');
    if (submission.status === 'disqualified') throw AppError.conflict('Ce projet est disqualifié');
    const ownTeam =
      submission.ownerType === 'team'
        ? await this.repos.teams.findById(submission.ownerId)
        : undefined;
    const own =
      (submission.ownerType === 'user' && submission.ownerId === user.id) ||
      (ownTeam?.memberIds.includes(user.id) ?? false);
    if (own) throw AppError.conflict('On ne vote pas pour son propre projet');

    const existing = await this.repos.votes.findOne(
      (v) => v.hackathonId === hackathon.id && v.userId === user.id,
    );
    if (existing) await this.repos.votes.update(existing.id, { submissionId });
    else await this.repos.votes.insert(createVote(hackathon.id, submissionId, user.id));
    this.events.emit(
      'submission',
      hackathon.slug,
      `${user.pseudo} a voté pour « ${submission.title} »`,
    );
    return this.summary(hackathon, user);
  }

  async withdraw(hackathon: Hackathon, user: UserRecord): Promise<VotesResponse> {
    if (!this.isOpen(hackathon)) throw AppError.conflict('Le vote du public est fermé');
    const existing = await this.repos.votes.findOne(
      (v) => v.hackathonId === hackathon.id && v.userId === user.id,
    );
    if (existing) await this.repos.votes.remove(existing.id);
    return this.summary(hackathon, user);
  }

  /** Projet le plus voté (ex æquo : le premier déposé). */
  async favorite(hackathon: Hackathon): Promise<{ submissionId: string; votes: number } | null> {
    if (!(hackathon.publicVote ?? false)) return null;
    const { counts } = await this.summary(hackathon, undefined);
    const submissions = await this.repos.submissions.filter((s) => s.hackathonId === hackathon.id);
    let best: { submissionId: string; votes: number } | null = null;
    for (const s of submissions.sort((a, b) => a.number - b.number)) {
      const votes = counts[s.id] ?? 0;
      if (votes > 0 && (!best || votes > best.votes)) best = { submissionId: s.id, votes };
    }
    return best;
  }
}
