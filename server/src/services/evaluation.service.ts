import type {
  Evaluation,
  Hackathon,
  JuryResponse,
  ResultEntry,
  ResultsResponse,
  Submission,
} from '@hackametz/shared';
import { createEvaluation } from '../models/evaluation.model';
import type { UserRecord } from '../models/user.model';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';
import { nowIso } from '../utils/time';
import type { VoteService } from './vote.service';

/** Statuts pour lesquels le classement est public. */
const PUBLISHED_STATUSES = new Set(['finished', 'archived']);

/**
 * Jury et notation : chaque juré note chaque projet sur les critères pondérés du hackathon ;
 * le classement est la moyenne des scores normalisés sur 100.
 */
export class EvaluationService {
  constructor(
    private readonly repos: Repositories,
    private readonly votes: VoteService,
  ) {}

  // ---------------------------------------------------------------- jury

  async jury(hackathon: Hackathon): Promise<JuryResponse['jury']> {
    const users = await this.repos.users.all();
    return hackathon.juryIds.flatMap((id) => {
      const u = users.find((x) => x.id === id);
      return u ? [{ id: u.id, pseudo: u.pseudo, avatarSeed: u.avatarSeed }] : [];
    });
  }

  /** Remplace le jury par la liste de pseudos donnée ; un pseudo inconnu est refusé. */
  async setJury(hackathon: Hackathon, pseudos: string[]): Promise<Hackathon> {
    const users = await this.repos.users.all();
    const ids: string[] = [];
    const unknown: string[] = [];
    for (const pseudo of pseudos) {
      const user = users.find((u) => u.pseudoNormalized === pseudo.trim().toLowerCase());
      if (!user) unknown.push(pseudo);
      else if (!ids.includes(user.id)) ids.push(user.id);
    }
    if (unknown.length > 0) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `Pseudo(s) inconnu(s) : ${unknown.join(', ')} — ils doivent d'abord entrer sur la plateforme`,
        unknown.map((pseudo) => ({ path: 'pseudos', message: `${pseudo} : inconnu` })),
      );
    }
    return this.repos.hackathons.update(hackathon.id, { juryIds: ids, updatedAt: nowIso() });
  }

  isJuror(hackathon: Hackathon, user: UserRecord | undefined): boolean {
    return user !== undefined && hackathon.juryIds.includes(user.id);
  }

  // ---------------------------------------------------------------- notes

  async mine(hackathon: Hackathon, juror: UserRecord): Promise<Evaluation[]> {
    return this.repos.evaluations.filter(
      (e) => e.hackathonId === hackathon.id && e.juryId === juror.id,
    );
  }

  async forSubmission(submission: Submission): Promise<Evaluation[]> {
    return this.repos.evaluations.filter((e) => e.submissionId === submission.id);
  }

  /** Crée ou met à jour la note d'un juré pour un projet. */
  async upsert(
    hackathon: Hackathon,
    submission: Submission,
    juror: UserRecord,
    input: { scores: Record<string, number>; comment: string },
  ): Promise<Evaluation> {
    if (submission.hackathonId !== hackathon.id) throw AppError.notFound('Projet');
    if (!['running', 'submissions_closed', 'judging'].includes(hackathon.status)) {
      throw AppError.conflict('La notation est fermée : les résultats sont publiés');
    }
    if (hackathon.criteria.length === 0) {
      throw AppError.conflict("Ce hackathon n'a pas de critères d'évaluation");
    }
    if (submission.status === 'disqualified') {
      throw AppError.conflict('Ce projet est disqualifié');
    }

    const scores: Record<string, number> = {};
    const details: { path: string; message: string }[] = [];
    for (const criterion of hackathon.criteria) {
      const value = input.scores[criterion.id];
      if (value === undefined || Number.isNaN(value)) {
        details.push({
          path: `scores.${criterion.id}`,
          message: `${criterion.label} : note manquante`,
        });
      } else if (value < 0 || value > criterion.maxScore) {
        details.push({
          path: `scores.${criterion.id}`,
          message: `${criterion.label} : entre 0 et ${criterion.maxScore}`,
        });
      } else {
        scores[criterion.id] = value;
      }
    }
    if (details.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Notes incomplètes ou hors barème', details);
    }

    const existing = await this.repos.evaluations.findOne(
      (e) => e.submissionId === submission.id && e.juryId === juror.id,
    );
    if (existing) {
      return this.repos.evaluations.update(existing.id, {
        scores,
        comment: input.comment,
        updatedAt: nowIso(),
      });
    }
    return this.repos.evaluations.insert(
      createEvaluation({
        hackathonId: hackathon.id,
        submissionId: submission.id,
        juryId: juror.id,
        juryPseudo: juror.pseudo,
        scores,
        comment: input.comment,
      }),
    );
  }

  // ---------------------------------------------------------------- classement

  /** Score normalisé sur 100 d'une évaluation : Σ (note / max × poids) / Σ poids. */
  normalizedScore(hackathon: Hackathon, evaluation: Evaluation): number {
    const totalWeight = hackathon.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = hackathon.criteria.reduce((sum, c) => {
      const value = evaluation.scores[c.id] ?? 0;
      return sum + (value / c.maxScore) * c.weight;
    }, 0);
    return Math.round((weighted / totalWeight) * 1000) / 10;
  }

  async results(hackathon: Hackathon, includeUnpublished: boolean): Promise<ResultsResponse> {
    const published = PUBLISHED_STATUSES.has(hackathon.status);
    const [submissions, evaluations] = await Promise.all([
      this.repos.submissions.filter((s) => s.hackathonId === hackathon.id),
      this.repos.evaluations.filter((e) => e.hackathonId === hackathon.id),
    ]);

    if (!published && !includeUnpublished) {
      return {
        published: false,
        juryCount: hackathon.juryIds.length,
        entries: [],
        publicFavorite: null,
      };
    }
    const { counts: voteCounts } = await this.votes.summary(hackathon, undefined);

    const scored = submissions.map((s) => {
      const mine = evaluations.filter((e) => e.submissionId === s.id);
      const score =
        mine.length === 0
          ? null
          : Math.round(
              (mine.reduce((sum, e) => sum + this.normalizedScore(hackathon, e), 0) / mine.length) *
                10,
            ) / 10;
      const byCriterion: Record<string, number> = {};
      for (const c of hackathon.criteria) {
        if (mine.length > 0) {
          byCriterion[c.id] =
            Math.round(
              (mine.reduce((sum, e) => sum + (e.scores[c.id] ?? 0), 0) / mine.length) * 10,
            ) / 10;
        }
      }
      return { submission: s, score, evaluations: mine, byCriterion };
    });

    // Disqualifiés en bas, puis par score décroissant ; sans note → après les notés.
    // À égalité, la règle de départage choisie par l'organisateur tranche.
    const tieBreak = hackathon.tieBreak ?? { mode: 'publicVote', criterionId: null };
    const breakTie = (a: (typeof scored)[number], b: (typeof scored)[number]): number => {
      switch (tieBreak.mode) {
        case 'publicVote':
          return (voteCounts[b.submission.id] ?? 0) - (voteCounts[a.submission.id] ?? 0);
        case 'criterion': {
          const id = tieBreak.criterionId ?? hackathon.criteria[0]?.id;
          if (!id) return 0;
          return (b.byCriterion[id] ?? 0) - (a.byCriterion[id] ?? 0);
        }
        case 'submittedAt':
          return a.submission.submittedAt.localeCompare(b.submission.submittedAt);
        case 'none':
        default:
          return 0;
      }
    };

    scored.sort((a, b) => {
      const aOut = a.submission.status === 'disqualified';
      const bOut = b.submission.status === 'disqualified';
      if (aOut !== bOut) return aOut ? 1 : -1;
      if (a.score === null && b.score === null) return a.submission.number - b.submission.number;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      if (a.score !== b.score) return b.score - a.score;
      const tie = breakTie(a, b);
      return tie !== 0 ? tie : a.submission.number - b.submission.number;
    });

    let rank = 0;
    let previousScore: number | null | undefined;
    const entries: ResultEntry[] = scored.map((row, index) => {
      const eligible = row.submission.status !== 'disqualified' && row.score !== null;
      // Rang partagé seulement si le score ET la règle de départage laissent les deux à égalité.
      const previous = index > 0 ? scored[index - 1] : undefined;
      const stillTied =
        previous !== undefined && row.score === previousScore && breakTie(previous, row) === 0;
      if (eligible && !stillTied) rank = index + 1;
      previousScore = row.score;
      const entryRank = eligible ? rank : scored.length;
      const prize = eligible
        ? (hackathon.prizes.find((p) => p.rank === entryRank)?.label ?? null)
        : null;
      return {
        rank: entryRank,
        submissionId: row.submission.id,
        number: row.submission.number,
        title: row.submission.title,
        ownerPseudo: row.submission.ownerPseudo,
        ownerType: row.submission.ownerType,
        teamMembers: row.submission.teamMembers,
        techStack: row.submission.techStack,
        status: row.submission.status,
        score: row.score,
        evaluationCount: row.evaluations.length,
        byCriterion: row.byCriterion,
        prize,
        comments: published
          ? row.evaluations
              .filter((e) => e.comment.trim().length > 0)
              .map((e) => ({ juryPseudo: e.juryPseudo, comment: e.comment }))
          : [],
        publicVotes: voteCounts[row.submission.id] ?? 0,
      };
    });

    return {
      published,
      juryCount: hackathon.juryIds.length,
      entries,
      publicFavorite: await this.votes.favorite(hackathon),
    };
  }
}
