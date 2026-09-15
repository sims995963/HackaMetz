import type { Question } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createQuestion(
  hackathonId: string,
  author: { id: string; pseudo: string },
  content: string,
): Question {
  return {
    id: newId(),
    hackathonId,
    authorId: author.id,
    authorPseudo: author.pseudo,
    content,
    answer: null,
    upvoterIds: [],
    createdAt: nowIso(),
  };
}
