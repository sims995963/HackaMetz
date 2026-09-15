import type {
  Submission,
  SubmissionFiles,
  SubmissionMeta,
  SubmissionStatus,
  SubmissionVersion,
} from '@hackametz/shared';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

/** Qui possède le dépôt : un candidat seul, ou son équipe. */
export interface SubmissionOwner {
  type: 'user' | 'team';
  id: string;
  /** Pseudo ou nom d'équipe : sert à l'affichage et au nom du dossier. */
  label: string;
  /** Pseudos des membres (vide pour un dépôt individuel). */
  members: string[];
}

export interface NewSubmissionParams {
  hackathonId: string;
  number: number;
  owner: SubmissionOwner;
  submittedByUserId: string;
  meta: SubmissionMeta;
  files: SubmissionFiles;
  version: SubmissionVersion;
  status: SubmissionStatus;
  license: string;
}

export function createSubmission(p: NewSubmissionParams): Submission {
  const now = nowIso();
  const { consentPublish: _consent, ...meta } = p.meta;
  return {
    id: newId(),
    hackathonId: p.hackathonId,
    number: p.number,
    ownerType: p.owner.type,
    ownerId: p.owner.id,
    ownerPseudo: p.owner.label,
    teamMembers: p.owner.members,
    ...meta,
    files: p.files,
    versions: [p.version],
    status: p.status,
    consent: { publish: true, license: p.license, at: now },
    submittedByUserId: p.submittedByUserId,
    submittedAt: now,
    updatedAt: now,
  };
}

/** Nouvelle version d'un dépôt existant : métadonnées et fichiers remplacés, historique conservé. */
export function applyResubmission(
  existing: Submission,
  p: {
    owner: SubmissionOwner;
    submittedByUserId: string;
    meta: SubmissionMeta;
    files: SubmissionFiles;
    version: SubmissionVersion;
    status: SubmissionStatus;
  },
): Submission {
  const { consentPublish: _consent, ...meta } = p.meta;
  return {
    ...existing,
    ...meta,
    ownerPseudo: p.owner.label,
    teamMembers: p.owner.members,
    files: p.files,
    versions: [...existing.versions, p.version],
    status: p.status,
    submittedByUserId: p.submittedByUserId,
    updatedAt: nowIso(),
  };
}
