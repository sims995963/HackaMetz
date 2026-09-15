import type { Hackathon, Team, TeamMine, TeamPublic } from '@hackametz/shared';
import { createTeam } from '../models/team.model';
import type { UserRecord } from '../models/user.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';

/**
 * Équipes d'un hackathon : création par un inscrit, adhésion par code d'invitation,
 * taille bornée par les paramètres du hackathon. L'inscription garde `teamId` en miroir.
 */
export class TeamService {
  constructor(
    private readonly repos: Repositories,
    private readonly events: EventBus,
  ) {}

  async create(hackathon: Hackathon, user: UserRecord, name: string): Promise<TeamMine> {
    await this.assertCanJoinATeam(hackathon, user);
    const taken = await this.repos.teams.findOne(
      (t) => t.hackathonId === hackathon.id && t.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (taken) throw AppError.conflict('Une équipe porte déjà ce nom');

    const team = await this.repos.teams.insert(createTeam(hackathon.id, name, user.id));
    await this.setRegistrationTeam(hackathon.id, user.id, team.id);
    this.events.emit('team', hackathon.slug, `${user.pseudo} a créé l’équipe « ${team.name} »`);
    return this.toMine(team);
  }

  async join(hackathon: Hackathon, user: UserRecord, inviteCode: string): Promise<TeamMine> {
    await this.assertCanJoinATeam(hackathon, user);
    const team = await this.repos.teams.findOne(
      (t) => t.hackathonId === hackathon.id && t.inviteCode === inviteCode.trim().toUpperCase(),
    );
    if (!team) throw AppError.notFound("Équipe (code d'invitation inconnu)");
    if (team.memberIds.length >= hackathon.team.maxSize) {
      throw AppError.conflict(
        `L’équipe « ${team.name} » est complète (${hackathon.team.maxSize} max)`,
      );
    }
    const updated = await this.repos.teams.update(team.id, {
      memberIds: [...team.memberIds, user.id],
    });
    await this.setRegistrationTeam(hackathon.id, user.id, team.id);
    this.events.emit('team', hackathon.slug, `${user.pseudo} a rejoint l’équipe « ${team.name} »`);
    return this.toMine(updated);
  }

  async leave(hackathon: Hackathon, user: UserRecord): Promise<void> {
    const team = await this.teamOf(hackathon.id, user.id);
    if (!team) throw AppError.notFound('Équipe');
    const remaining = team.memberIds.filter((id) => id !== user.id);

    if (remaining.length === 0) {
      const submission = await this.repos.submissions.findOne(
        (s) => s.ownerType === 'team' && s.ownerId === team.id,
      );
      if (submission) {
        throw AppError.conflict('L’équipe a déposé un projet : elle ne peut pas être dissoute');
      }
      await this.repos.teams.remove(team.id);
    } else {
      await this.repos.teams.update(team.id, {
        memberIds: remaining,
        leaderId: team.leaderId === user.id ? remaining[0]! : team.leaderId,
      });
    }
    await this.setRegistrationTeam(hackathon.id, user.id, null);
    this.events.emit('team', hackathon.slug, `${user.pseudo} a quitté l’équipe « ${team.name} »`);
  }

  teamOf(hackathonId: string, userId: string): Promise<Team | undefined> {
    return this.repos.teams.findOne(
      (t) => t.hackathonId === hackathonId && t.memberIds.includes(userId),
    );
  }

  async mine(hackathonId: string, userId: string): Promise<TeamMine | null> {
    const team = await this.teamOf(hackathonId, userId);
    return team ? this.toMine(team) : null;
  }

  async listPublic(hackathonId: string): Promise<TeamPublic[]> {
    const teams = await this.repos.teams.filter((t) => t.hackathonId === hackathonId);
    const users = await this.repos.users.all();
    return teams
      .map((t) => this.toPublic(t, users))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async toMine(team: Team): Promise<TeamMine> {
    const users = await this.repos.users.all();
    return { ...this.toPublic(team, users), inviteCode: team.inviteCode };
  }

  /** Pseudos des membres, dans l'ordre d'arrivée. */
  async memberPseudos(team: Team): Promise<string[]> {
    const users = await this.repos.users.all();
    return team.memberIds.flatMap((id) => {
      const user = users.find((u) => u.id === id);
      return user ? [user.pseudo] : [];
    });
  }

  private toPublic(team: Team, users: UserRecord[]): TeamPublic {
    const { inviteCode: _code, memberIds, ...rest } = team;
    return {
      ...rest,
      members: memberIds.flatMap((id) => {
        const user = users.find((u) => u.id === id);
        return user ? [{ id: user.id, pseudo: user.pseudo, avatarSeed: user.avatarSeed }] : [];
      }),
    };
  }

  private async assertCanJoinATeam(hackathon: Hackathon, user: UserRecord): Promise<void> {
    if (!hackathon.team.enabled) {
      throw AppError.conflict('Ce hackathon se joue en solo : pas d’équipes');
    }
    const registration = await this.repos.registrations.findOne(
      (r) => r.hackathonId === hackathon.id && r.userId === user.id,
    );
    if (!registration)
      throw AppError.forbidden('Inscris-toi au hackathon avant de former une équipe');
    if (await this.teamOf(hackathon.id, user.id)) {
      throw AppError.conflict('Tu fais déjà partie d’une équipe : quitte-la d’abord');
    }
  }

  private async setRegistrationTeam(hackathonId: string, userId: string, teamId: string | null) {
    const registration = await this.repos.registrations.findOne(
      (r) => r.hackathonId === hackathonId && r.userId === userId,
    );
    if (registration) await this.repos.registrations.update(registration.id, { teamId });
  }
}
