import type { Hackathon, JoinInput, Participant, Registration } from '@hackametz/shared';
import { STATUSES_OPEN_FOR_REGISTRATION } from '@hackametz/shared';
import { createRegistration } from '../models/registration.model';
import type { UserRecord } from '../models/user.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';

export class RegistrationService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  /** Inscription idempotente : rejoindre deux fois renvoie la même inscription. */
  async join(hackathon: Hackathon, user: UserRecord, input: JoinInput): Promise<Registration> {
    const existing = await this.find(hackathon.id, user.id);
    if (existing) return existing;

    if (!STATUSES_OPEN_FOR_REGISTRATION.includes(hackathon.status)) {
      throw AppError.conflict('Les inscriptions ne sont pas ouvertes pour ce hackathon');
    }
    const opensAt = hackathon.dates.registrationOpensAt;
    if (opensAt && new Date(opensAt) > new Date()) {
      throw AppError.conflict("Les inscriptions n'ont pas encore ouvert");
    }
    if (hackathon.visibility === 'private' && hackathon.accessCode) {
      if (input.accessCode !== hackathon.accessCode) {
        throw AppError.forbidden("Code d'accès invalide");
      }
    }
    if (hackathon.maxParticipants !== null) {
      const count = await this.countFor(hackathon.id);
      if (count >= hackathon.maxParticipants) {
        throw AppError.conflict('Ce hackathon est complet');
      }
    }

    const registration = await this.repos.registrations.insert(
      createRegistration(hackathon.id, user.id),
    );
    this.events.emit('registration', hackathon.slug, `${user.pseudo} a rejoint le hackathon`);
    return registration;
  }

  async leave(hackathon: Hackathon, user: UserRecord): Promise<void> {
    const existing = await this.find(hackathon.id, user.id);
    if (!existing) throw AppError.notFound('Inscription');
    const submission = await this.repos.submissions.findOne(
      (s) => s.hackathonId === hackathon.id && s.ownerId === user.id,
    );
    if (submission) {
      throw AppError.conflict('Tu as déjà déposé un projet : impossible de quitter ce hackathon');
    }
    if (existing.teamId) {
      throw AppError.conflict('Quitte d’abord ton équipe');
    }
    await this.repos.registrations.remove(existing.id);
    this.events.emit('registration', hackathon.slug, `${user.pseudo} a quitté le hackathon`);
  }

  find(hackathonId: string, userId: string): Promise<Registration | undefined> {
    return this.repos.registrations.findOne(
      (r) => r.hackathonId === hackathonId && r.userId === userId,
    );
  }

  async countFor(hackathonId: string): Promise<number> {
    return (await this.repos.registrations.filter((r) => r.hackathonId === hackathonId)).length;
  }

  async participants(hackathonId: string): Promise<Participant[]> {
    const [registrations, users, teams] = await Promise.all([
      this.repos.registrations.filter((r) => r.hackathonId === hackathonId),
      this.repos.users.all(),
      this.repos.teams.filter((t) => t.hackathonId === hackathonId),
    ]);
    const byId = new Map(users.map((u) => [u.id, u]));
    return registrations
      .flatMap((r) => {
        const user = byId.get(r.userId);
        if (!user) return [];
        const team = teams.find((t) => t.memberIds.includes(user.id));
        return [
          {
            id: user.id,
            pseudo: user.pseudo,
            avatarSeed: user.avatarSeed,
            joinedAt: r.joinedAt,
            teamName: team?.name ?? null,
          },
        ];
      })
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  forUser(userId: string): Promise<Registration[]> {
    return this.repos.registrations.filter((r) => r.userId === userId);
  }
}
