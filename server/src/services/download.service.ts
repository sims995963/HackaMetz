import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import type { Hackathon, Submission } from '@hackametz/shared';
import { PUBLIC_HACKATHON_STATUSES } from '@hackametz/shared';
import { projectRoot } from '../config/paths';
import type { Repositories } from '../repositories';
import { collectFiles, totalBytes, type ZipEntry } from '../storage/archive';
import type { HackathonStorage } from '../storage/hackathon.storage';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/slugify';

/**
 * Les archives d'origine ne sont jamais redistribuées : à l'extraction, le serveur écarte
 * `node_modules`, les `.env` et les chemins suspects. Renvoyer le zip déposé par le candidat
 * contournerait ce filtrage. C'est `source/` — le code tel que la plateforme l'expose — qui part.
 */
const NEVER_BUNDLED = ['archives', 'node_modules', '.git'] as const;

/** Bornes larges : du code, ça pèse des mégaoctets, pas des gigaoctets. */
const LIMITS = { maxFiles: 50_000, maxBytes: 1024 * 1024 * 1024 };

export interface DownloadBundle {
  fileName: string;
  entries: ZipEntry[];
  fileCount: number;
  /** Taille cumulée avant compression : le vrai zip sera plus léger. */
  bytes: number;
}

/**
 * Prépare les téléchargements en zip : un projet, une édition entière, ou toute la base
 * de connaissance. Le code source de l'application elle-même passe par `git archive`.
 */
export class DownloadService {
  constructor(
    private readonly repos: Repositories,
    private readonly storage: HackathonStorage,
  ) {}

  /** Un projet : son manifest et son code. */
  async project(id: string, includeDrafts: boolean): Promise<DownloadBundle> {
    const submission = await this.repos.submissions.findById(id);
    if (!submission) throw AppError.notFound('Projet');
    const hackathon = await this.visibleHackathon(submission.hackathonId, includeDrafts);

    const folder = this.projectFolder(submission);
    const prefix = `${hackathon.code}-${slugify(submission.title) || 'projet'}`;
    const entries = await collectFiles(folder, prefix, { ...LIMITS, skipDirs: NEVER_BUNDLED });
    if (entries.length === 0) throw AppError.notFound('Code du projet');

    return this.bundle(`${prefix}.zip`, entries);
  }

  /** Une édition : son README, son manifest et tous ses projets. */
  async edition(slug: string, includeDrafts: boolean): Promise<DownloadBundle> {
    const hackathon = await this.repos.hackathons.findOne((h) => h.slug === slug);
    if (!hackathon || !this.isVisible(hackathon, includeDrafts)) throw AppError.notFound('Édition');

    // Le dossier d'une édition existe dès sa création (manifest + README) : c'est le nombre
    // de dépôts qui dit si l'archive a un intérêt, pas la présence de fichiers.
    const projects = await this.repos.submissions.filter((s) => s.hackathonId === hackathon.id);
    if (projects.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'Cette édition ne contient encore aucun projet');
    }

    const prefix = `${hackathon.code}-${hackathon.slug}`;
    const entries = await collectFiles(this.storage.folderOf(hackathon), prefix, {
      ...LIMITS,
      skipDirs: NEVER_BUNDLED,
    });
    return this.bundle(`hackametz-${prefix}.zip`, entries);
  }

  /**
   * Toute la base de connaissance. Les éditions encore en brouillon sont exclues pour le
   * public : le zip contient exactement ce que la galerie laisse voir.
   */
  async knowledgeBase(includeDrafts: boolean): Promise<DownloadBundle> {
    const [hackathons, submissions] = await Promise.all([
      this.repos.hackathons.all(),
      this.repos.submissions.all(),
    ]);
    const withProjects = new Set(submissions.map((s) => s.hackathonId));
    const visible = hackathons.filter(
      (h) => this.isVisible(h, includeDrafts) && withProjects.has(h.id),
    );
    if (visible.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'La base de connaissance est encore vide');
    }

    const root = 'hackametz-base-de-connaissance';
    const entries: ZipEntry[] = [];
    for (const hackathon of visible.sort((a, b) => a.code.localeCompare(b.code))) {
      entries.push(
        ...(await collectFiles(
          this.storage.folderOf(hackathon),
          `${root}/hackathons/${hackathon.code}-${hackathon.slug}`,
          { ...LIMITS, skipDirs: NEVER_BUNDLED },
        )),
      );
    }
    if (entries.length === 0) {
      throw new AppError(404, 'NOT_FOUND', 'La base de connaissance ne contient encore aucun code');
    }
    entries.unshift({
      name: `${root}/README.md`,
      content: this.rootReadme(visible),
      size: 0,
    });
    return this.bundle(`${root}.zip`, entries);
  }

  /**
   * Code de l'application. `git archive` ne connaît que les fichiers suivis : le `.env`,
   * les données et le dossier `storage/` restent dehors sans qu'on ait à les lister.
   *
   * On attend le premier octet avant de rendre la main : si git manque ou si le dossier
   * n'est pas un dépôt, l'erreur remonte en JSON plutôt qu'en plein milieu d'un zip.
   */
  async appSource(): Promise<{ fileName: string; stream: Readable }> {
    const child = spawn('git', ['archive', '--format=zip', '-9', '--prefix=hackametz/', 'HEAD'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 2000) stderr += chunk.toString('utf8');
    });

    const unavailable = (reason: string) =>
      new AppError(503, 'INTERNAL_ERROR', `Export du code impossible : ${reason}`);

    await new Promise<void>((resolve, reject) => {
      child.once('error', () => reject(unavailable('git est introuvable sur le serveur')));
      child.stdout.once('readable', resolve);
      child.once('close', (code) => {
        if (code === 0) resolve();
        else reject(unavailable(stderr.trim().split('\n')[0] ?? `git a répondu ${code}`));
      });
    });

    const out = new PassThrough();
    child.stdout.pipe(out);
    // Échec après coup (dépôt corrompu) : le téléchargement est coupé net, jamais tronqué en silence.
    child.once('close', (code) => {
      if (code !== 0 && code !== null) out.destroy(unavailable(`git a répondu ${code}`));
    });

    const date = new Date().toISOString().slice(0, 10);
    return { fileName: `hackametz-app-${date}.zip`, stream: out };
  }

  // -------------------------------------------------------------------------

  private bundle(fileName: string, entries: ZipEntry[]): DownloadBundle {
    return { fileName, entries, fileCount: entries.length, bytes: totalBytes(entries) };
  }

  private isVisible(hackathon: Hackathon, includeDrafts: boolean): boolean {
    return includeDrafts || PUBLIC_HACKATHON_STATUSES.includes(hackathon.status);
  }

  private async visibleHackathon(id: string, includeDrafts: boolean): Promise<Hackathon> {
    const hackathon = await this.repos.hackathons.findById(id);
    // Un projet d'édition non publiée n'existe pas pour le public : 404, pas 403.
    if (!hackathon || !this.isVisible(hackathon, includeDrafts)) throw AppError.notFound('Projet');
    return hackathon;
  }

  /** `.../projects/01-alice/source` → `.../projects/01-alice` */
  private projectFolder(submission: Submission): string {
    return dirname(this.storage.absolute(submission.files.sourcePath));
  }

  private rootReadme(hackathons: Hackathon[]): string {
    const lines = [
      '# HackaMetz — base de connaissance',
      '',
      `Archive générée le ${new Date().toISOString().slice(0, 10)}.`,
      '',
      'Un dossier par édition dans `hackathons/`, un sous-dossier par projet dans `projects/`,',
      'avec le code dans `source/` et un manifest `project.json`.',
      '',
      '| Code | Édition | Thème |',
      '| --- | --- | --- |',
      ...hackathons.map((h) => `| ${h.code} | ${h.title} | ${h.theme} |`),
      '',
    ];
    return lines.join('\n');
  }
}

/** Nom de fichier sûr pour l'en-tête `Content-Disposition`. */
export function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
}
