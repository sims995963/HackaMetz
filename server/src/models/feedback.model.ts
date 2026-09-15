import type { Feedback, FeedbackInput } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createFeedback(
  hackathonId: string,
  userId: string,
  input: Required<FeedbackInput>,
): Feedback {
  const at = nowIso();
  return { id: newId(), hackathonId, userId, ...input, createdAt: at, updatedAt: at };
}
