import type { EnterResponse, PseudoPolicy, User } from '@hackametz/shared';
import { createUser, normalizePseudo, toPublicUser, type UserRecord } from '../models/user.model';
import type { Repositories } from '../repositories';
import { hashToken, newDeviceToken } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { nowIso } from '../utils/time';

/**
 * Identité par pseudo seul.
 *
 * - `free` : n'importe qui peut entrer avec n'importe quel pseudo existant.
 * - `device-bound` : un pseudo est lié aux appareils qui l'ont utilisé ; un nouvel
 *   appareil est refusé tant que l'admin n'a pas libéré le pseudo.
 */
export class AuthService {
  constructor(
    private readonly repos: Repositories,
    private readonly policy: PseudoPolicy,
  ) {}

  async enter(pseudo: string, presentedToken?: string): Promise<EnterResponse> {
    const normalized = normalizePseudo(pseudo);
    const existing = await this.repos.users.findOne((u) => u.pseudoNormalized === normalized);

    if (!existing) {
      const token = newDeviceToken();
      const user = createUser(pseudo);
      user.deviceTokenHashes.push(hashToken(token));
      await this.repos.users.insert(user);
      return { user: toPublicUser(user), token, created: true };
    }

    // Appareil déjà connu : on renouvelle simplement la session.
    if (presentedToken && existing.deviceTokenHashes.includes(hashToken(presentedToken))) {
      const user = await this.touch(existing.id);
      return { user, token: presentedToken, created: false };
    }

    if (this.policy === 'device-bound' && existing.deviceTokenHashes.length > 0) {
      throw new AppError(
        409,
        'PSEUDO_TAKEN',
        "Ce pseudo est déjà utilisé sur un autre appareil. Demande à l'organisateur de le libérer, ou choisis-en un autre.",
      );
    }

    const token = newDeviceToken();
    const updated = await this.repos.users.update(existing.id, (u) => ({
      ...u,
      deviceTokenHashes: [...u.deviceTokenHashes, hashToken(token)],
      lastSeenAt: nowIso(),
    }));
    return { user: toPublicUser(updated), token, created: false };
  }

  /** Retrouve l'utilisateur à partir d'un token d'appareil, ou undefined. */
  async authenticate(token: string): Promise<UserRecord | undefined> {
    const hash = hashToken(token);
    return this.repos.users.findOne((u) => u.deviceTokenHashes.includes(hash));
  }

  /** Libère un pseudo : tous ses appareils sont déconnectés, le prochain « entrer » le récupère. */
  async release(userId: string): Promise<User> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw AppError.notFound('Utilisateur');
    const updated = await this.repos.users.update(userId, { deviceTokenHashes: [] });
    return toPublicUser(updated);
  }

  async listUsers(): Promise<User[]> {
    const users = await this.repos.users.all();
    return users.map(toPublicUser);
  }

  private async touch(userId: string): Promise<User> {
    const updated = await this.repos.users.update(userId, { lastSeenAt: nowIso() });
    return toPublicUser(updated);
  }
}
