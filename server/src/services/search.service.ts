import type { Hackathon, SearchResult, SearchResponse } from '@hackametz/shared';
import { HACKATHON_STATUS_LABELS, PUBLIC_HACKATHON_STATUSES } from '@hackametz/shared';
import type { Repositories } from '../repositories';

/** Minuscules sans accents : « Écologie » et « ecologie » se trouvent l'un l'autre. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Score d'un candidat : 0 = pas de correspondance. Le titre pèse plus que le reste,
 * et un début de mot plus qu'une occurrence au milieu.
 */
function score(needle: string, title: string, others: string[]): number {
  const t = normalize(title);
  if (t === needle) return 100;
  if (t.startsWith(needle)) return 80;
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').test(t)) return 60;
  if (t.includes(needle)) return 45;
  const rest = normalize(others.filter(Boolean).join(' '));
  if (rest.includes(` ${needle}`) || rest.startsWith(needle)) return 30;
  if (rest.includes(needle)) return 20;
  return 0;
}

const MAX_PER_TYPE = 6;

/** Recherche globale derrière la palette de commandes : éditions, projets, technos, pseudos. */
export class SearchService {
  constructor(private readonly repos: Repositories) {}

  async search(rawQuery: string, includeDrafts: boolean): Promise<SearchResponse> {
    const query = rawQuery.trim();
    const needle = normalize(query);
    if (needle.length === 0) return { query, results: [] };

    const [hackathons, submissions, users, teams] = await Promise.all([
      this.repos.hackathons.all(),
      this.repos.submissions.all(),
      this.repos.users.all(),
      this.repos.teams.all(),
    ]);
    const visible = hackathons.filter(
      (h) => includeDrafts || PUBLIC_HACKATHON_STATUSES.includes(h.status),
    );
    const hackathonById = new Map(visible.map((h) => [h.id, h]));

    const scored: { result: SearchResult; weight: number }[] = [];
    const push = (weight: number, result: SearchResult) => {
      if (weight > 0) scored.push({ weight, result });
    };

    for (const h of visible) {
      push(score(needle, h.title, [h.theme, h.description, h.location, ...h.tags]), {
        type: 'hackathon',
        id: h.id,
        title: h.title,
        subtitle: h.theme || HACKATHON_STATUS_LABELS[h.status],
        to: `/hackathons/${h.slug}`,
        code: h.code,
        coverColor: h.coverColor,
        badge: HACKATHON_STATUS_LABELS[h.status],
      });
    }

    for (const s of submissions) {
      const h = hackathonById.get(s.hackathonId);
      if (!h) continue;
      const weight = score(needle, s.title, [
        s.pitch,
        s.description,
        s.ownerPseudo,
        ...s.teamMembers,
        ...s.techStack,
      ]);
      push(weight, {
        type: 'project',
        id: s.id,
        title: s.title,
        subtitle: `${s.ownerPseudo} · #${h.code} ${h.title}`,
        to: `/hackathons/${h.slug}/projects/${s.id}`,
        code: h.code,
        coverColor: h.coverColor,
        badge: s.techStack[0] ?? null,
      });
    }

    const techCounts = new Map<string, number>();
    for (const s of submissions) {
      if (!hackathonById.has(s.hackathonId)) continue;
      for (const tech of s.techStack) techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
    }
    for (const [tech, count] of techCounts) {
      push(score(needle, tech, []), {
        type: 'tech',
        id: `tech:${tech}`,
        title: tech,
        subtitle: `${count} projet${count > 1 ? 's' : ''} dans la base`,
        to: `/kb?tech=${encodeURIComponent(tech)}`,
        code: null,
        coverColor: null,
        badge: null,
      });
    }

    for (const u of users) {
      const editions = this.editionsOf(u.id, visible, submissions, teams);
      if (editions === 0 && !includeDrafts) continue;
      push(score(needle, u.pseudo, []), {
        type: 'person',
        id: u.id,
        title: u.pseudo,
        subtitle:
          editions > 0 ? `${editions} projet${editions > 1 ? 's' : ''} déposé(s)` : 'pseudo inscrit',
        to: `/kb?q=${encodeURIComponent(u.pseudo)}`,
        code: null,
        coverColor: null,
        badge: null,
      });
    }

    const perType = new Map<string, number>();
    const results = scored
      .sort((a, b) => b.weight - a.weight || a.result.title.localeCompare(b.result.title, 'fr'))
      .filter(({ result }) => {
        const seen = perType.get(result.type) ?? 0;
        if (seen >= MAX_PER_TYPE) return false;
        perType.set(result.type, seen + 1);
        return true;
      })
      .map(({ result }) => result);

    return { query, results };
  }

  /** Nombre de projets visibles auxquels ce pseudo a contribué (en solo ou en équipe). */
  private editionsOf(
    userId: string,
    visible: Hackathon[],
    submissions: { hackathonId: string; ownerType: string; ownerId: string }[],
    teams: { id: string; memberIds: string[] }[],
  ): number {
    const visibleIds = new Set(visible.map((h) => h.id));
    const myTeamIds = new Set(teams.filter((t) => t.memberIds.includes(userId)).map((t) => t.id));
    return submissions.filter(
      (s) =>
        visibleIds.has(s.hackathonId) &&
        ((s.ownerType === 'user' && s.ownerId === userId) ||
          (s.ownerType === 'team' && myTeamIds.has(s.ownerId))),
    ).length;
  }
}
