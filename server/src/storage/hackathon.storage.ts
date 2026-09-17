import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  FileContentResponse,
  Hackathon,
  ResultsResponse,
  Submission,
} from '@hackametz/shared';
import { HACKATHON_STATUS_LABELS } from '@hackametz/shared';
import { slugify } from '../utils/slugify';
import { buildTree, readProjectFile } from './tree';
import { extractZip, sha256File, type ExtractLimits, type ExtractResult } from './zip';

export interface StoreArchiveParams {
  hackathon: Hackathon;
  /** Nom du dossier du projet : 01-simon */
  folderName: string;
  version: number;
  /** Archive reçue (fichier temporaire), déplacée dans le dossier du projet. */
  tempZipPath: string;
  limits: ExtractLimits;
}

export interface RootIndexRow {
  code: string;
  folder: string;
  title: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  participants: number;
  projects: number;
  winner: string | null;
}

export interface StoredArchive {
  sourcePath: string;
  archivePath: string;
  archiveBytes: number;
  sha256: string;
  extract: ExtractResult;
}

/**
 * Système de fichiers de la base de connaissance :
 *   <storageDir>/hackathons/001-slug/
 *     hackathon.json                manifest du hackathon
 *     README.md                     généré : thème, dates, projets
 *     projects/01-pseudo/
 *       project.json                manifest du dépôt
 *       source/                     code extrait et filtré (dernière version)
 *       archives/v1.zip, v2.zip…    archives d'origine
 */
export class HackathonStorage {
  constructor(readonly storageDir: string) {}

  /** Dossier des uploads en cours, sur le même volume que la destination (déplacement atomique). */
  async tempDir(): Promise<string> {
    const dir = join(this.storageDir, '.tmp');
    await mkdir(dir, { recursive: true });
    return dir;
  }

  absolute(relativePath: string): string {
    return join(this.storageDir, relativePath);
  }

  folderOf(hackathon: Hackathon): string {
    return this.absolute(hackathon.storagePath);
  }

  projectFolderName(number: number, pseudo: string): string {
    return `${String(number).padStart(2, '0')}-${slugify(pseudo) || 'candidat'}`;
  }

  async createFolder(hackathon: Hackathon): Promise<string> {
    const folder = this.folderOf(hackathon);
    await mkdir(join(folder, 'projects'), { recursive: true });
    await this.writeManifest(hackathon);
    await this.writeHackathonReadme(hackathon, []);
    return folder;
  }

  async writeManifest(hackathon: Hackathon): Promise<void> {
    const manifest = {
      code: hackathon.code,
      slug: hackathon.slug,
      title: hackathon.title,
      theme: hackathon.theme,
      tags: hackathon.tags,
      format: hackathon.format,
      dates: hackathon.dates,
      status: hackathon.status,
      team: hackathon.team,
      criteria: hackathon.criteria,
      license: hackathon.submission.license,
    };
    await mkdir(this.folderOf(hackathon), { recursive: true });
    await writeFile(
      join(this.folderOf(hackathon), 'hackathon.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8',
    );
  }

  /**
   * Range l'archive dans archives/vN.zip puis extrait le code dans source/.
   * L'extraction se fait dans un dossier de travail, remplacé d'un coup en cas de succès :
   * une archive invalide ne détruit jamais la version précédente.
   */
  async storeProjectArchive(p: StoreArchiveParams): Promise<StoredArchive> {
    const projectDir = join(this.folderOf(p.hackathon), 'projects', p.folderName);
    const archivesDir = join(projectDir, 'archives');
    const sourceDir = join(projectDir, 'source');
    const workDir = join(projectDir, 'source.new');
    await mkdir(archivesDir, { recursive: true });

    const archiveAbs = join(archivesDir, `v${p.version}.zip`);
    await rename(p.tempZipPath, archiveAbs);

    await rm(workDir, { recursive: true, force: true });
    await mkdir(workDir, { recursive: true });
    let extract: ExtractResult;
    try {
      extract = await extractZip(archiveAbs, workDir, p.limits);
    } catch (err) {
      await rm(workDir, { recursive: true, force: true });
      await rm(archiveAbs, { force: true });
      if (p.version === 1) await rm(projectDir, { recursive: true, force: true });
      throw err;
    }
    await rm(sourceDir, { recursive: true, force: true });
    await rename(workDir, sourceDir);

    const { size } = await stat(archiveAbs);
    return {
      sourcePath: this.relative(sourceDir),
      archivePath: this.relative(archiveAbs),
      archiveBytes: size,
      sha256: await sha256File(archiveAbs),
      extract,
    };
  }

  /**
   * Annule un dépôt qui vient d'être écrit (mode strict : secrets détectés).
   * La version précédente, si elle existe, reste en place.
   */
  async removeProjectVersion(stored: StoredArchive): Promise<void> {
    const sourceDir = this.absolute(stored.sourcePath);
    await rm(sourceDir, { recursive: true, force: true });
    await rm(this.absolute(stored.archivePath), { force: true });
  }

  async writeProjectManifest(hackathon: Hackathon, submission: Submission): Promise<void> {
    const projectDir = join(this.absolute(submission.files.sourcePath), '..');
    const manifest = {
      hackathon: { code: hackathon.code, slug: hackathon.slug, title: hackathon.title },
      number: submission.number,
      title: submission.title,
      author: submission.ownerPseudo,
      pitch: submission.pitch,
      techStack: submission.techStack,
      languages: submission.files.languages,
      repoUrl: submission.repoUrl,
      demoUrl: submission.demoUrl,
      videoUrl: submission.videoUrl,
      license: submission.consent.license,
      status: submission.status,
      versions: submission.versions,
      sha256: submission.files.sha256,
      submittedAt: submission.submittedAt,
      updatedAt: submission.updatedAt,
    };
    await writeFile(
      join(projectDir, 'project.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8',
    );
  }

  /** Journal Discord de l'équipe, à côté de `project.json` et de `source/`. */
  async writeProjectJournal(sourcePath: string, markdown: string): Promise<void> {
    const projectDir = join(this.absolute(sourcePath), '..');
    await writeFile(join(projectDir, 'journal.md'), markdown, 'utf8');
  }

  async writeHackathonReadme(
    hackathon: Hackathon,
    submissions: Submission[],
    results?: ResultsResponse,
  ): Promise<void> {
    await writeFile(
      join(this.folderOf(hackathon), 'README.md'),
      renderReadme(hackathon, submissions, results),
      'utf8',
    );
  }

  /** Index de toute la base de connaissance, à la racine de storage/. */
  async writeRootReadme(rows: RootIndexRow[]): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
    const lines = [
      '# HackaMetz — base de connaissance',
      '',
      'Un dossier par hackathon (`hackathons/NNN-slug/`), un sous-dossier par projet (`projects/NN-auteur/`) avec le code dans `source/`, les archives d’origine dans `archives/` et un manifest `project.json`.',
      '',
      `${rows.length} hackathon${rows.length > 1 ? 's' : ''}, ${rows.reduce((n, r) => n + r.projects, 0)} projets.`,
      '',
      '| # | Hackathon | Thème | Dates | Participants | Projets | Vainqueur |',
      '|---|---|---|---|---|---|---|',
      ...rows.map(
        (r) =>
          `| ${r.code} | [${r.title}](hackathons/${r.folder}/) | ${r.theme} | ${r.startsAt.slice(0, 10)} → ${r.endsAt.slice(0, 10)} | ${r.participants} | ${r.projects} | ${r.winner ?? '—'} |`,
      ),
      '',
    ];
    await writeFile(join(this.storageDir, 'README.md'), lines.join('\n'), 'utf8');
  }

  /** Les uploads en cours ne doivent jamais partir dans Git. */
  async writeGitignore(): Promise<void> {
    await writeFile(
      join(this.storageDir, '.gitignore'),
      ['.tmp/', 'source.new/', ''].join('\n'),
      'utf8',
    );
  }

  async treeOf(submission: Submission) {
    return buildTree(this.absolute(submission.files.sourcePath));
  }

  async readFileOf(submission: Submission, relativePath: string): Promise<FileContentResponse> {
    return readProjectFile(this.absolute(submission.files.sourcePath), relativePath);
  }

  private relative(absolutePath: string): string {
    return relative(this.storageDir, absolutePath).split('\\').join('/');
  }
}

function renderReadme(h: Hackathon, submissions: Submission[], results?: ResultsResponse): string {
  const lines = [
    `# ${h.code} — ${h.title}`,
    '',
    `**Thème :** ${h.theme}`,
    '',
    `- Statut : ${HACKATHON_STATUS_LABELS[h.status]}`,
    `- Début : ${h.dates.startsAt}`,
    `- Deadline de soumission : ${h.dates.submissionDeadlineAt}`,
    `- Fin : ${h.dates.endsAt}`,
    `- Licence des projets : ${h.submission.license}`,
    h.tags.length ? `- Tags : ${h.tags.join(', ')}` : null,
    '',
    `## Projets (${submissions.length})`,
    '',
  ].filter((line): line is string => line !== null);

  if (submissions.length === 0) {
    lines.push('_Aucun projet déposé pour le moment._');
  } else {
    lines.push('| # | Projet | Auteur | Technos | Dossier |', '|---|---|---|---|---|');
    for (const s of [...submissions].sort((a, b) => a.number - b.number)) {
      const folder = s.files.sourcePath.split('/').slice(-2, -1)[0] ?? '';
      lines.push(
        `| ${String(s.number).padStart(2, '0')} | ${s.title} | ${s.ownerPseudo} | ${s.techStack.join(', ')} | \`projects/${folder}/\` |`,
      );
    }
  }
  if (results?.published && results.entries.some((e) => e.score !== null)) {
    lines.push(
      '',
      '## Classement',
      '',
      '| Rang | Projet | Auteur | Score /100 | Prix |',
      '|---|---|---|---|---|',
    );
    for (const e of results.entries.filter((x) => x.score !== null)) {
      lines.push(`| ${e.rank} | ${e.title} | ${e.ownerPseudo} | ${e.score} | ${e.prize ?? ''} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
