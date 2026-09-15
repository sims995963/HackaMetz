import type { Evaluation } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createEvaluation(p: {
  hackathonId: string;
  submissionId: string;
  juryId: string;
  juryPseudo: string;
  scores: Record<string, number>;
  comment: string;
}): Evaluation {
  const now = nowIso();
  return { id: newId(), ...p, createdAt: now, updatedAt: now };
}
