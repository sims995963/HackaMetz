import type {
  Achievement,
  AchievementId,
  Hackathon,
  HackathonRef,
  MeDetailsResponse,
  MyResult,
} from '@hackametz/shared';
import { toPublicUser, type UserRecord } from '../models/user.model';
import type { Repositories } from '../repositories';
import type { EvaluationService } from './evaluation.service';

const ACHIEVEMENTS: Record<AchievementId, { label: string; description: string }> = {
  first_steps: { label: 'Premiers pas', description: 'Première inscription à une édition.' },
  builder: { label: 'Builder', description: 'Premier projet déposé.' },
  team_player: { label: 'Esprit d’équipe', description: 'A participé au sein d’une équipe.' },
  podium_1: { label: 'Or', description: '1ʳᵉ place au classement du jury.' },
  podium_2: { label: 'Argent', description: '2ᵉ place au classement du jury.' },
  podium_3: { label: 'Bronze', description: '3ᵉ place au classement du jury.' },
  crowd_favorite: { label: 'Coup de cœur', description: 'Projet préféré du public.' },
  juror: { label: 'Juré', description: 'A fait partie d’un jury.' },
  veteran: { label: 'Vétéran', description: 'Trois éditions ou plus.' },
  curious: { label: 'Curieux', description: 'A posé une question à l’organisateur.' },
};

const FINISHED = new Set(['finished', 'archived']);

/** Un fait daté rattaché (ou non) à une édition, matière première du palmarès. */
interface Fact {
  at: string;
  hackathon: HackathonRef | null;
}

function refOf(h: Hackathon): HackathonRef {
  return {
    id: h.id,
    code: h.code,
    slug: h.slug,
    title: h.title,
    status: h.status,
    coverColor: h.coverColor,
    submissionDeadlineAt: h.dates.submissionDeadlineAt,
  };
}

function oldest(items: Fact[]): Fact | undefined {
  return items.slice().sort((a, b) => a.at.localeCompare(b.at))[0];
}

/** Profil complet d'un pseudo : inscriptions, projets, résultats finaux et palmarès. */
export class ProfileService {
  constructor(
    private readonly repos: Repositories,
    private readonly evaluations: EvaluationService,
  ) {}

  async details(user: UserRecord): Promise<MeDetailsResponse> {
    const [registrations, teams, allSubmissions, hackathons, users, questions] = await Promise.all([
      this.repos.registrations.filter((r) => r.userId === user.id),
      this.repos.teams.filter((t) => t.memberIds.includes(user.id)),
      this.repos.submissions.all(),
      this.repos.hackathons.all(),
      this.repos.users.all(),
      this.repos.questions.filter((q) => q.authorId === user.id),
    ]);
    const teamIds = new Set(teams.map((t) => t.id));
    const submissions = allSubmissions.filter(
      (s) =>
        (s.ownerType === 'user' && s.ownerId === user.id) ||
        (s.ownerType === 'team' && teamIds.has(s.ownerId)),
    );
    const pseudoOf = (id: string) => users.find((u) => u.id === id)?.pseudo ?? '?';
    const hackathonOf = (id: string) => hackathons.find((h) => h.id === id);
    const fact = (at: string, hackathonId: string): Fact => {
      const h = hackathonOf(hackathonId);
      return { at, hackathon: h ? refOf(h) : null };
    };

    const results = await this.resultsFor(submissions, hackathonOf, teams);
    const achievements = this.achievementsFor({
      registrations: registrations.map((r) => fact(r.joinedAt, r.hackathonId)),
      submissions: submissions.map((s) => fact(s.submittedAt, s.hackathonId)),
      teams: teams.map((t) => fact(t.createdAt, t.hackathonId)),
      questions: questions.map((q) => fact(q.createdAt, q.hackathonId)),
      results,
      juryOf: hackathons
        .filter((h) => h.juryIds.includes(user.id))
        .map((h) => ({ at: h.dates.startsAt, hackathon: refOf(h) })),
    });

    return {
      user: toPublicUser(user),
      registrations: registrations
        .flatMap((r) => {
          const h = hackathonOf(r.hackathonId);
          if (!h) return [];
          const team = teams.find((t) => t.hackathonId === r.hackathonId);
          return [
            {
              hackathon: refOf(h),
              joinedAt: r.joinedAt,
              team: team
                ? {
                    id: team.id,
                    name: team.name,
                    inviteCode: team.inviteCode,
                    memberPseudos: team.memberIds.map(pseudoOf),
                    isLeader: team.leaderId === user.id,
                  }
                : null,
            },
          ];
        })
        .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)),
      submissions: submissions
        .flatMap((s) => {
          const h = hackathonOf(s.hackathonId);
          return h
            ? [
                {
                  id: s.id,
                  hackathon: refOf(h),
                  title: s.title,
                  status: s.status,
                  version: s.versions.length,
                  submittedAt: s.updatedAt,
                },
              ]
            : [];
        })
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      results,
      achievements,
    };
  }

  /** Classement final de chaque projet de l'utilisateur sur les éditions terminées. */
  private async resultsFor(
    submissions: { id: string; hackathonId: string; ownerType: string; ownerId: string }[],
    hackathonOf: (id: string) => Hackathon | undefined,
    teams: { id: string; name: string }[],
  ): Promise<MyResult[]> {
    const out: MyResult[] = [];
    for (const s of submissions) {
      const h = hackathonOf(s.hackathonId);
      if (!h || !FINISHED.has(h.status)) continue;
      const results = await this.evaluations.results(h, false);
      const entry = results.entries.find((e) => e.submissionId === s.id);
      if (!entry) continue;
      const team = s.ownerType === 'team' ? teams.find((t) => t.id === s.ownerId) : undefined;
      out.push({
        hackathon: refOf(h),
        submissionId: s.id,
        title: entry.title,
        rank: entry.rank,
        total: results.entries.length,
        score: entry.score,
        prize: entry.prize,
        publicFavorite: results.publicFavorite?.submissionId === s.id,
        teamName: team?.name ?? null,
        teamMembers: entry.teamMembers,
      });
    }
    return out.sort((a, b) =>
      b.hackathon.submissionDeadlineAt.localeCompare(a.hackathon.submissionDeadlineAt),
    );
  }

  private achievementsFor(input: {
    registrations: Fact[];
    submissions: Fact[];
    teams: Fact[];
    questions: Fact[];
    results: MyResult[];
    juryOf: Fact[];
  }): Achievement[] {
    const list: Achievement[] = [];
    const add = (id: AchievementId, { at, hackathon }: Fact) =>
      list.push({ id, ...ACHIEVEMENTS[id], hackathon, earnedAt: at });

    const firstReg = oldest(input.registrations);
    if (firstReg) add('first_steps', firstReg);
    const firstSub = oldest(input.submissions);
    if (firstSub) add('builder', firstSub);
    const firstTeam = oldest(input.teams);
    if (firstTeam) add('team_player', firstTeam);
    const third = input.registrations.slice().sort((a, b) => a.at.localeCompare(b.at))[2];
    if (third) add('veteran', { at: third.at, hackathon: null });
    for (const r of input.results) {
      const f: Fact = { at: r.hackathon.submissionDeadlineAt, hackathon: r.hackathon };
      if (r.rank === 1) add('podium_1', f);
      else if (r.rank === 2) add('podium_2', f);
      else if (r.rank === 3) add('podium_3', f);
      if (r.publicFavorite) add('crowd_favorite', f);
    }
    const jury = oldest(input.juryOf);
    if (jury) add('juror', jury);
    const question = oldest(input.questions);
    if (question) add('curious', question);

    return list.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  }
}
