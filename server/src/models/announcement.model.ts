import type { Announcement } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

export function createAnnouncement(
  hackathonId: string,
  input: { title: string; content: string; pinned: boolean },
): Announcement {
  return { id: newId(), hackathonId, ...input, createdAt: nowIso() };
}
