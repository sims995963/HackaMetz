import { rm } from 'node:fs/promises';
import type {
  FileContentResponse,
  Hackathon,
  Submission,
  SubmissionMeta,
  SubmissionStatus,
  TreeResponse,
} from '@hackametz/shared';
import {
  applyResubmission,
  createSubmission,
  type SubmissionOwner,
} from '../models/submission.model';
import type { UserRecord } from '../models/user.model';
import type { EventBus } from '../realtime/eventBus';
import type { Repositories } from '../repositories';
import type { HackathonStorage } from '../storage/hackathon.storage';
import { AppError } from '../utils/errors';
import { nowIso } from '../utils/time';
import type { RegistrationService } from './registration.service';
import type { TeamService } from './team.service';

export interface UploadedArchive {
  /** Fichier temporaire écrit par multer. */
  path: string;
  size: number;
  originalName: string;
}

export interface SubmitParams {
  hackathon: Hackathon;
  user: UserRecord;
  meta: SubmissionMeta;
  archive: UploadedArchive;
  /** Seed / admin : ignore le statut, la deadline et l'inscription. */
  force?: boolean;
}

export class SubmissionService {
  constructor(
    private readonly repos: Repositories,
    private readonly storage: HackathonStorage,
    private readonly registrations: RegistrationService,
    private readonly teams: TeamService,
    private readonly events: EventBus,
  ) {}

  /**
   * Dépôt (ou re-dépôt) d'un projet : contrôles métier, rangement de l'archive,
   * extraction filtrée, enregistrement, manifests et README régénérés.
   */
  async submit(p: SubmitParams): Promise<Submission> {
    const { hackathon, user, meta, archive } = p;
    try {
      const status = p.force ? 'submitted' : await this.checkCanSubmit(hackathon, user, archive);
      const owner = await this.resolveOwner(hackathon, user, p.force ?? false);
      const existing = await this.repos.submissions.findOne(
        (s) =>
          s.hackathonId === hackathon.id && s.ownerType === owner.type && s.ownerId === owner.id,
      );
      if (existing && !hackathon.submission.allowResubmit && !p.force) {
        throw AppError.conflict('Ce hackathon ne permet pas de re-déposer un projet');
      }

      const number = existing?.number ?? (await this.nextNumber(hackathon.id));
      const version = (existing?.versions.length ?? 0) + 1;
      const stored = await this.storage.storeProjectArchive({
        hackathon,
        folderName: this.storage.projectFolderName(number, owner.label),
        version,
        tempZipPath: archive.path,
        limits: {
          maxFiles: hackathon.submission.maxFiles,
          maxBytes: hackathon.submission.maxSizeMb * 1024 * 1024 * 4,
        },
      });

      // Mode strict : on refuse le dépôt et on efface ce qui vient d'être extrait.
      if (hackathon.submission.rejectSecrets && stored.extract.warnings.length > 0) {
        await this.storage.removeProjectVersion(stored);
        throw new AppError(
          409,
          'CONFLICT',
          'Des secrets ont été détectés dans ton dépôt : retire-les puis redépose.',
          stored.extract.warnings.map((warning) => {
            const [path, kind] = warning.split(' : ');
            return { path: path ?? warning, message: kind ?? 'secret probable' };
          }),
        );
      }

      const files = {
        sourcePath: stored.sourcePath,
        archivePath: stored.archivePath,
        archiveBytes: stored.archiveBytes,
        sizeBytes: stored.extract.sizeBytes,
        fileCount: stored.extract.fileCount,
        skippedCount: stored.extract.skippedCount,
        languages: stored.extract.languages,
        hasReadme: stored.extract.hasReadme,
        sha256: stored.sha256,
        warnings: stored.extract.warnings,
      };
      const versionEntry = {
        version,
        archivePath: stored.archivePath,
        archiveBytes: stored.archiveBytes,
        sha256: stored.sha256,
        submittedAt: nowIso(),
      };

      const submission = existing
        ? await this.repos.submissions.update(existing.id, (current) =>
            applyResubmission(current, {
              owner,
              submittedByUserId: user.id,
              meta,
              files,
              version: versionEntry,
              status,
            }),
          )
        : await this.repos.submissions.insert(
            createSubmission({
              hackathonId: hackathon.id,
              number,
              owner,
              submittedByUserId: user.id,
              meta,
              files,
              version: versionEntry,
              status,
              license: hackathon.submission.license,
            }),
          );

      await this.storage.writeProjectManifest(hackathon, submission);
      await this.storage.writeHackathonReadme(hackathon, await this.listFor(hackathon.id));
      this.events.emit(
        'submission',
        hackathon.slug,
        existing
          ? `${owner.label} a mis à jour « ${submission.title} » (v${version})`
          : `${owner.label} a déposé « ${submission.title} »`,
      );
      return submission;
    } finally {
      // L'archive temporaire a été déplacée en cas de succès ; sinon on la nettoie.
      await rm(archive.path, { force: true });
    }
  }

  listFor(hackathonId: string): Promise<Submission[]> {
    return this.repos.submissions
      .filter((s) => s.hackathonId === hackathonId)
      .then((list) => list.sort((a, b) => a.number - b.number));
  }

  /** Dépôts auxquels un utilisateur est associé : les siens et ceux de ses équipes. */
  async forUser(user: UserRecord): Promise<Submission[]> {
    const teams = await this.repos.teams.filter((t) => t.memberIds.includes(user.id));
    const teamIds = new Set(teams.map((t) => t.id));
    return this.repos.submissions.filter(
      (s) =>
        (s.ownerType === 'user' && s.ownerId === user.id) ||
        (s.ownerType === 'team' && teamIds.has(s.ownerId)),
    );
  }

  async get(id: string): Promise<Submission> {
    const submission = await this.repos.submissions.findById(id);
    if (!submission) throw AppError.notFound('Projet');
    return submission;
  }

  async tree(id: string): Promise<TreeResponse> {
    return this.storage.treeOf(await this.get(id));
  }

  async file(id: string, relativePath: string): Promise<FileContentResponse> {
    return this.storage.readFileOf(await this.get(id), relativePath);
  }

  async updateStatus(id: string, status: SubmissionStatus): Promise<Submission> {
    await this.get(id);
    return this.repos.submissions.update(id, { status, updatedAt: nowIso() });
  }

  /** En solo, le candidat dépose pour lui ; en équipe, n'importe quel membre dépose pour l'équipe. */
  private async resolveOwner(
    hackathon: Hackathon,
    user: UserRecord,
    force: boolean,
  ): Promise<SubmissionOwner> {
    if (!hackathon.team.enabled) {
      return { type: 'user', id: user.id, label: user.pseudo, members: [] };
    }
    const team = await this.teams.teamOf(hackathon.id, user.id);
    if (!team) {
      if (force) return { type: 'user', id: user.id, label: user.pseudo, members: [] };
      throw AppError.forbidden('Rejoins ou crée une équipe avant de déposer le projet');
    }
    if (!force && team.memberIds.length < hackathon.team.minSize) {
      throw AppError.conflict(
        `Ton équipe doit compter au moins ${hackathon.team.minSize} membres pour déposer`,
      );
    }
    return {
      type: 'team',
      id: team.id,
      label: team.name,
      members: await this.teams.memberPseudos(team),
    };
  }

  private async checkCanSubmit(
    hackathon: Hackathon,
    user: UserRecord,
    archive: UploadedArchive,
  ): Promise<SubmissionStatus> {
    if (!(await this.registrations.find(hackathon.id, user.id))) {
      throw AppError.forbidden('Inscris-toi au hackathon avant de déposer un projet');
    }
    if (!/\.zip$/i.test(archive.originalName)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Le dépôt doit être une archive .zip');
    }
    const maxBytes = hackathon.submission.maxSizeMb * 1024 * 1024;
    if (archive.size > maxBytes) {
      throw new AppError(
        413,
        'VALIDATION_ERROR',
        `Archive trop volumineuse (maximum ${hackathon.submission.maxSizeMb} Mo)`,
      );
    }

    const now = Date.now();
    const deadline = new Date(hackathon.dates.submissionDeadlineAt).getTime();
    const late = now > deadline;
    const open = hackathon.status === 'running' && !late;
    const lateAllowed =
      hackathon.submission.allowLate &&
      late &&
      (hackathon.status === 'running' || hackathon.status === 'submissions_closed');

    if (open) return 'submitted';
    if (lateAllowed) return 'late';
    if (late) throw AppError.conflict('La deadline de dépôt est passée');
    throw AppError.conflict("Les dépôts ne sont pas ouverts : le hackathon n'est pas en cours");
  }

  private async nextNumber(hackathonId: string): Promise<number> {
    const all = await this.repos.submissions.filter((s) => s.hackathonId === hackathonId);
    return all.reduce((max, s) => Math.max(max, s.number), 0) + 1;
  }
}
