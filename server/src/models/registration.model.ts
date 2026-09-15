import type { Registration } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createRegistration(hackathonId: string, userId: string): Registration {
  const now = nowIso();
  return { id: newId(), hackathonId, userId, teamId: null, acceptedRulesAt: now, joinedAt: now };
}
