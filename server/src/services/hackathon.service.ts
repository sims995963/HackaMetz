import type {
  ActivityItem,
  AdminStats,
  CreateHackathonData,
  Hackathon,
  HackathonStatus,
  HackathonWithCounts,
  PublicStats,
  UpdateHackathonData,
} from '@hackametz/shared';
import {
  HACKATHON_STATUSES,
  HACKATHON_STATUS_LABELS,
  PUBLIC_HACKATHON_STATUSES,
  STATUS_TRANSITIONS,
  datesAreOrdered,
  hackathonSchema,
} from '@hackametz/shared';
import { createHackathon } from '../models/hackathon.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import type { HackathonStorage } from '../storage/hackathon.storage';
import { AppError } from '../utils/errors';
import { newId } from '../utils/ids';
import { slugify } from '../utils/slugify';
import type { ProposalService } from './proposal.service';
import { nowIso } from '../utils/time';

export interface ListOptions {
  status?: HackathonStatus;
  /** Les brouillons ne sont visibles que par l'admin. */
  includeDrafts?: boolean;
}

export class HackathonService {
  constructor(
    private readonly repos: Repositories,
    private readonly storage: HackathonStorage,
    private readonly events: EventBus,
    private readonly proposals: ProposalService,
  ) {}

  /** Du plus récent au plus ancien, avec les compteurs. */
  async list(options: ListOptions = {}): Promise<HackathonWithCounts[]> {
    const all = await this.repos.hackathons.all();
    const visible = all
      .filter((h) => options.includeDrafts || PUBLIC_HACKATHON_STATUSES.includes(h.status))
      .filter((h) => !options.status || h.status === options.status)
      .sort((a, b) => b.number - a.number);
    return this.withCounts(visible);
  }

  async getBySlug(slug: string, includeDrafts = false): Promise<Hackathon> {
    const hackathon = await this.repos.hackathons.findOne((h) => h.slug === slug);
    if (!hackathon || (!includeDrafts && !PUBLIC_HACKATHON_STATUSES.includes(hackathon.status))) {
      throw AppError.notFound('Hackathon');
    }
    return hackathon;
  }

  async getBySlugWithCounts(slug: string, includeDrafts = false): Promise<HackathonWithCounts> {
    const [withCounts] = await this.withCounts([await this.getBySlug(slug, includeDrafts)]);
    return withCounts!;
  }

  /** Crée le hackathon (brouillon), lui attribue le numéro suivant et son dossier de stockage. */
  async create(data: CreateHackathonData): Promise<Hackathon> {
    const all = await this.repos.hackathons.all();
    const number = all.reduce((max, h) => Math.max(max, h.number), 0) + 1;
    const slug = this.uniqueSlug(data.slug ?? slugify(data.title), all);
    const hackathon = createHackathon(data, number, slug);
    await this.repos.hackathons.insert(hackathon);
    await this.storage.createFolder(hackathon);
    if (data.fromRoundId) await this.proposals.linkHackathon(data.fromRoundId, hackathon.id);
    return hackathon;
  }

  /** Modification partielle ; le slug et le numéro ne changent jamais après création. */
  async update(slug: string, patch: UpdateHackathonData): Promise<Hackathon> {
    const existing = await this.getBySlug(slug, true);
    const { slug: _slug, criteria, ...rest } = patch;
    const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const merged: Hackathon = {
      ...existing,
      ...defined,
      criteria: criteria ? criteria.map((c) => ({ ...c, id: c.id ?? newId() })) : existing.criteria,
      updatedAt: nowIso(),
    };
    const parsed = hackathonSchema.safeParse(merged);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Hackathon invalide après modification');
    }
    if (!datesAreOrdered(parsed.data.dates)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Les dates doivent être ordonnées', [
        { path: 'dates.submissionDeadlineAt', message: 'début ≤ deadline ≤ fin' },
      ]);
    }
    if (parsed.data.team.enabled && parsed.data.team.minSize > parsed.data.team.maxSize) {
      throw new AppError(400, 'VALIDATION_ERROR', "Taille d'équipe incohérente", [
        { path: 'team.maxSize', message: 'min ≤ max' },
      ]);
    }
    const updated = await this.repos.hackathons.update(existing.id, parsed.data);
    await this.storage.writeManifest(updated);
    return updated;
  }

  /** Transition manuelle par l'admin, limitée au graphe STATUS_TRANSITIONS. */
  async changeStatus(slug: string, status: HackathonStatus): Promise<Hackathon> {
    const existing = await this.getBySlug(slug, true);
    if (existing.status === status) return existing;
    if (!STATUS_TRANSITIONS[existing.status].includes(status)) {
      throw AppError.conflict(`Passage ${existing.status} → ${status} impossible`);
    }
    return this.setStatus(existing, status);
  }

  /**
   * Transitions automatiques selon les dates (appelé par le scheduler) :
   * published → running au début, running → submissions_closed à la deadline.
   */
  async applyScheduledTransitions(now = new Date()): Promise<Hackathon[]> {
    const all = await this.repos.hackathons.all();
    const changed: Hackathon[] = [];
    for (const h of all) {
      if (h.status === 'published' && new Date(h.dates.startsAt) <= now) {
        changed.push(await this.setStatus(h, 'running'));
      } else if (
        h.status === 'running' &&
        !h.submission.allowLate &&
        new Date(h.dates.submissionDeadlineAt) <= now
      ) {
        changed.push(await this.setStatus(h, 'submissions_closed'));
      }
    }
    return changed;
  }

  async publicStats(): Promise<PublicStats> {
    const [hackathons, registrations, submissions] = await Promise.all([
      this.repos.hackathons.all(),
      this.repos.registrations.all(),
      this.repos.submissions.all(),
    ]);
    const visible = hackathons.filter((h) => PUBLIC_HACKATHON_STATUSES.includes(h.status));
    return {
      hackathons: visible.length,
      running: visible.filter((h) => h.status === 'running').length,
      participants: new Set(registrations.map((r) => r.userId)).size,
      submissions: submissions.length,
    };
  }

  /** Les diagnostics système sont ajoutés par le contrôleur : ils ne dépendent pas des données métier. */
  async adminStats(): Promise<Omit<AdminStats, 'diagnostics'>> {
    const [base, hackathons, users, registrations, submissions, questions, feedback] =
      await Promise.all([
        this.publicStats(),
        this.repos.hackathons.all(),
        this.repos.users.all(),
        this.repos.registrations.all(),
        this.repos.submissions.all(),
        this.repos.questions.all(),
        this.repos.feedback.all(),
      ]);
    const byStatus = Object.fromEntries(HACKATHON_STATUSES.map((s) => [s, 0])) as Record<
      HackathonStatus,
      number
    >;
    for (const h of hackathons) byStatus[h.status] += 1;

    const userById = new Map(users.map((u) => [u.id, u.pseudo]));
    const hackathonById = new Map(hackathons.map((h) => [h.id, h]));
    const activity: ActivityItem[] = [
      ...registrations.map((r) => ({
        type: 'registration' as const,
        at: r.joinedAt,
        pseudo: userById.get(r.userId) ?? '?',
        hackathonTitle: hackathonById.get(r.hackathonId)?.title ?? null,
        hackathonSlug: hackathonById.get(r.hackathonId)?.slug ?? null,
        label: 'a rejoint',
      })),
      ...submissions.map((s) => ({
        type: 'submission' as const,
        at: s.updatedAt,
        pseudo: s.ownerPseudo,
        hackathonTitle: hackathonById.get(s.hackathonId)?.title ?? null,
        hackathonSlug: hackathonById.get(s.hackathonId)?.slug ?? null,
        label: s.versions.length > 1 ? `a re-déposé « ${s.title} »` : `a déposé « ${s.title} »`,
      })),
      ...users.map((u) => ({
        type: 'user' as const,
        at: u.createdAt,
        pseudo: u.pseudo,
        hackathonTitle: null,
        hackathonSlug: null,
        label: 'a créé son pseudo',
      })),
      ...questions.map((q) => ({
        type: 'question' as const,
        at: q.createdAt,
        pseudo: q.authorPseudo,
        hackathonTitle: hackathonById.get(q.hackathonId)?.title ?? null,
        hackathonSlug: hackathonById.get(q.hackathonId)?.slug ?? null,
        label: q.answer ? 'a posé une question (répondue)' : 'a posé une question',
      })),
      ...feedback.map((f) => ({
        type: 'feedback' as const,
        at: f.updatedAt,
        pseudo: userById.get(f.userId) ?? '?',
        hackathonTitle: hackathonById.get(f.hackathonId)?.title ?? null,
        hackathonSlug: hackathonById.get(f.hackathonId)?.slug ?? null,
        label: `a noté ${f.rating}/5`,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20);

    return {
      ...base,
      hackathons: hackathons.length,
      users: users.length,
      byStatus,
      registrations: registrations.length,
      activity,
      pendingQuestions: hackathons
        .map((h) => ({
          hackathonSlug: h.slug,
          hackathonTitle: h.title,
          count: questions.filter((q) => q.hackathonId === h.id && !q.answer).length,
        }))
        .filter((x) => x.count > 0),
    };
  }

  private async setStatus(hackathon: Hackathon, status: HackathonStatus): Promise<Hackathon> {
    const updated = await this.repos.hackathons.update(hackathon.id, {
      status,
      updatedAt: nowIso(),
    });
    await this.storage.writeManifest(updated);
    this.events.emit(
      'status',
      updated.slug,
      `Le hackathon passe en « ${HACKATHON_STATUS_LABELS[status]} »`,
    );
    return updated;
  }

  private async withCounts(hackathons: Hackathon[]): Promise<HackathonWithCounts[]> {
    const [registrations, submissions] = await Promise.all([
      this.repos.registrations.all(),
      this.repos.submissions.all(),
    ]);
    return hackathons.map((h) => ({
      ...h,
      counts: {
        participants: registrations.filter((r) => r.hackathonId === h.id).length,
        submissions: submissions.filter((s) => s.hackathonId === h.id).length,
      },
    }));
  }

  private uniqueSlug(base: string, existing: Hackathon[]): string {
    if (!base)
      throw new AppError(400, 'VALIDATION_ERROR', 'Impossible de dériver un slug du titre');
    const taken = new Set(existing.map((h) => h.slug));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i += 1) {
      const candidate = `${base}-${i}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
}
