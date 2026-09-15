import type { CreateHackathonData, Hackathon } from '@hackametz/shared';
import { HACKATHON_CODE_WIDTH } from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

/** 1 → "001", 42 → "042", 1234 → "1234" */
export const formatHackathonCode = (number: number) =>
  String(number).padStart(HACKATHON_CODE_WIDTH, '0');

/** Chemin du dossier dans la base de connaissance, relatif à STORAGE_PATH. */
export const hackathonStoragePath = (code: string, slug: string) => `hackathons/${code}-${slug}`;

export function createHackathon(
  data: CreateHackathonData,
  number: number,
  slug: string,
): Hackathon {
  const now = nowIso();
  const code = formatHackathonCode(number);
  const { slug: _ignored, fromRoundId: _round, criteria, ...rest } = data;
  return {
    ...rest,
    id: newId(),
    number,
    code,
    slug,
    criteria: criteria.map((criterion) => ({ ...criterion, id: newId() })),
    status: 'draft',
    storagePath: hackathonStoragePath(code, slug),
    createdAt: now,
    updatedAt: now,
  };
}
