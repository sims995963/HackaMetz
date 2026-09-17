import type { Announcement, Hackathon } from '@hackametz/shared';
import { createAnnouncement } from '../models/announcement.model';
import type { IntegrationHooks } from '../integrations/hooks';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';

export class AnnouncementService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
    private readonly hooks: IntegrationHooks,
  ) {}

  /** Épinglées d'abord, puis de la plus récente à la plus ancienne. */
  async listFor(hackathonId: string): Promise<Announcement[]> {
    const all = await this.repos.announcements.filter((a) => a.hackathonId === hackathonId);
    return all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  async create(
    hackathon: Hackathon,
    input: { title: string; content: string; pinned: boolean },
  ): Promise<Announcement> {
    const announcement = await this.repos.announcements.insert(
      createAnnouncement(hackathon.id, input),
    );
    this.events.emit('announcement', hackathon.slug, `Annonce : ${announcement.title}`);
    await this.hooks.announcementPublished(hackathon, announcement);
    return announcement;
  }

  async remove(hackathon: Hackathon, id: string): Promise<void> {
    const existing = await this.repos.announcements.findById(id);
    if (!existing || existing.hackathonId !== hackathon.id) throw AppError.notFound('Annonce');
    await this.repos.announcements.remove(id);
  }
}
