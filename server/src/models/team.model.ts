import { randomInt } from 'node:crypto';
import type { Team } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { slugify } from '../utils/slugify';
import { nowIso } from '../utils/time';

/** Code court à dicter à voix haute : pas de 0/O ni de 1/I/L. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newInviteCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export function createTeam(hackathonId: string, name: string, leaderId: string): Team {
  return {
    id: newId(),
    hackathonId,
    name: name.trim(),
    slug: slugify(name) || 'equipe',
    inviteCode: newInviteCode(),
    leaderId,
    memberIds: [leaderId],
    createdAt: nowIso(),
  };
}
