import type { Vote } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createVote(hackathonId: string, submissionId: string, userId: string): Vote {
  return { id: newId(), hackathonId, submissionId, userId, createdAt: nowIso() };
}
