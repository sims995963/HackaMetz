import type { User, UserRole } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

/** Ce qui est stocké : l'utilisateur public + ses secrets (empreintes des tokens d'appareil). */
export interface UserRecord extends User {
  deviceTokenHashes: string[];
}

export const normalizePseudo = (pseudo: string) => pseudo.trim().toLowerCase();

export function createUser(pseudo: string, role: UserRole = 'participant'): UserRecord {
  const now = nowIso();
  return {
    id: newId(),
    pseudo: pseudo.trim(),
    pseudoNormalized: normalizePseudo(pseudo),
    avatarSeed: newId(),
    role,
    createdAt: now,
    lastSeenAt: now,
    deviceTokenHashes: [],
  };
}

/** Ne laisse jamais sortir les secrets. */
export function toPublicUser(record: UserRecord): User {
  const { deviceTokenHashes: _secrets, ...user } = record;
  return user;
}
