import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Hackathon, KbExportResponse, KbProject } from '@hackametz/shared';
import { PUBLIC_HACKATHON_STATUSES } from '@hackametz/shared';
import type { Repositories } from '../repositories';
import type { HackathonStorage, RootIndexRow } from '../storage/hackathon.storage';
import type { EvaluationService } from './evaluation.service';

const exec = promisify(execFile);

export interface KbQuery {
  q?: string;
  tech?: string;
  hackathon?: string;
}

/**
 * Base de connaissance : galerie de tous les projets, et export de `storage/` en dépôt Git
 * (README d'index, README par hackathon avec classement, manifests, commit optionnel).
 */
export class KnowledgeBaseService {
  constructor(
    private readonly repos: Repositories,
    private readonly storage: HackathonStorage,
    private readonly evaluations: EvaluationService,
  ) {}

  async projects(
    query: KbQuery,
    includeDrafts: boolean,
  ): Promise<{ projects: KbProject[]; technologies: string[] }> {
    const [hackathons, submissions] = await Promise.all([
      this.repos.hackathons.all(),
      this.repos.submissions.all(),
    ]);
    const visible = hackathons.filter(
      (h) => includeDrafts || PUBLIC_HACKATHON_STATUSES.includes(h.status),
    );
    const ranks = new Map<string, number | null>();
    for (const h of visible) {
      const results = await this.evaluations.results(h, includeDrafts);
      for (const e of results.entries)
        ranks.set(e.submissionId, results.published && e.score !== null ? e.rank : null);
    }

    const q = query.q?.trim().toLowerCase();
    const tech = query.tech?.trim().toLowerCase();
    const all: KbProject[] = submissions
      .flatMap((s) => {
        const h = visible.find((x) => x.id === s.hackathonId);
        if (!h) return [];
        return [
          {
            id: s.id,
            hackathon: {
              id: h.id,
              code: h.code,
              slug: h.slug,
              title: h.title,
              status: h.status,
              coverColor: h.coverColor,
              submissionDeadlineAt: h.dates.submissionDeadlineAt,
            },
            number: s.number,
            title: s.title,
            pitch: s.pitch,
            ownerPseudo: s.ownerPseudo,
            ownerType: s.ownerType,
            teamMembers: s.teamMembers,
            techStack: s.techStack,
            languages: s.files.languages,
            fileCount: s.files.fileCount,
            status: s.status,
            rank: ranks.get(s.id) ?? null,
            submittedAt: s.submittedAt,
          },
        ];
      })
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

    const technologies = [
      ...new Set(all.flatMap((p) => [...p.techStack, ...Object.keys(p.languages)])),
    ].sort((a, b) => a.localeCompare(b, 'fr'));

    const projects = all.filter((p) => {
      if (query.hackathon && p.hackathon.slug !== query.hackathon) return false;
      if (
        tech &&
        ![...p.techStack, ...Object.keys(p.languages)].some((t) => t.toLowerCase() === tech)
      )
        return false;
      if (!q) return true;
      const haystack = [
        p.title,
        p.pitch,
        p.ownerPseudo,
        ...p.teamMembers,
        ...p.techStack,
        p.hackathon.title,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    return { projects, technologies };
  }

  /** Régénère tous les README / manifests, puis commit si demandé. */
  async export(options: { commit: boolean }): Promise<KbExportResponse> {
    const [hackathons, submissions, registrations] = await Promise.all([
      this.repos.hackathons.all(),
      this.repos.submissions.all(),
      this.repos.registrations.all(),
    ]);
    const sorted = [...hackathons].sort((a, b) => a.number - b.number);
    const rows: RootIndexRow[] = [];
    let readmes = 0;

    for (const h of sorted) {
      const mine = submissions
        .filter((s) => s.hackathonId === h.id)
        .sort((a, b) => a.number - b.number);
      const results = await this.evaluations.results(h, true);
      await this.storage.writeManifest(h);
      await this.storage.writeHackathonReadme(h, mine, results);
      for (const s of mine) await this.storage.writeProjectManifest(h, s);
      readmes += 1;
      const winner = results.published
        ? (results.entries.find((e) => e.rank === 1 && e.score !== null) ?? null)
        : null;
      rows.push({
        code: h.code,
        folder: h.storagePath.split('/').pop() ?? h.storagePath,
        title: h.title,
        theme: h.theme,
        startsAt: h.dates.startsAt,
        endsAt: h.dates.endsAt,
        participants: registrations.filter((r) => r.hackathonId === h.id).length,
        projects: mine.length,
        winner: winner ? `${winner.title} (${winner.ownerPseudo})` : null,
      });
    }
    await this.storage.writeRootReadme(rows);
    await this.storage.writeGitignore();
    readmes += 1;

    const base: KbExportResponse = {
      hackathons: sorted.length,
      projects: submissions.length,
      readmes,
      committed: false,
      commitMessage: null,
      gitError: null,
    };
    if (!options.commit) return base;
    return { ...base, ...(await this.commit(sorted, submissions.length)) };
  }

  private async commit(
    hackathons: Hackathon[],
    projectCount: number,
  ): Promise<Pick<KbExportResponse, 'committed' | 'commitMessage' | 'gitError'>> {
    const cwd = this.storage.storageDir;
    const git = (...args: string[]) =>
      exec('git', ['-c', 'user.name=HackaMetz', '-c', 'user.email=hackametz@localhost', ...args], {
        cwd,
      });
    try {
      const inside = await git('rev-parse', '--is-inside-work-tree').then(
        (r) => r.stdout.trim() === 'true',
        () => false,
      );
      if (!inside) await git('init', '-q', '-b', 'main');
      await git('add', '-A');
      const status = await git('status', '--porcelain');
      if (status.stdout.trim() === '') {
        return {
          committed: false,
          commitMessage: null,
          gitError: 'Rien à committer : la base de connaissance est déjà à jour',
        };
      }
      const message = `Base de connaissance : ${hackathons.length} hackathon${hackathons.length > 1 ? 's' : ''}, ${projectCount} projet${projectCount > 1 ? 's' : ''} (${new Date().toISOString().slice(0, 16)})`;
      await git('commit', '-q', '-m', message);
      return { committed: true, commitMessage: message, gitError: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { committed: false, commitMessage: null, gitError: message.split('\n')[0] ?? message };
    }
  }
}
