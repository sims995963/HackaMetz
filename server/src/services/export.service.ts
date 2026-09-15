import type { Hackathon } from '@hackametz/shared';
import type { Repositories } from '../repositories';
import type { EvaluationService } from './evaluation.service';
import type { FeedbackService } from './feedback.service';
import type { RegistrationService } from './registration.service';

export const CSV_EXPORTS = ['participants', 'projets', 'resultats', 'retours'] as const;
export type CsvExport = (typeof CSV_EXPORTS)[number];

/** Échappement CSV (RFC 4180) : guillemets doublés, champ cité dès qu'il contient , ; " ou un saut de ligne. */
function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Marque d'ordre des octets : sans elle, Excel affiche « Ã© » à la place des accents. */
const BOM = String.fromCharCode(0xfeff);

function toCsv(headers: string[], rows: unknown[][]): string {
  return `${BOM}${[headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`;
}

/** Tableurs prêts à ouvrir pour l'organisateur : listes d'émargement, classement, retours. */
export class ExportService {
  constructor(
    private readonly repos: Repositories,
    private readonly registrations: RegistrationService,
    private readonly evaluations: EvaluationService,
    private readonly feedback: FeedbackService,
  ) {}

  async csv(hackathon: Hackathon, kind: CsvExport): Promise<string> {
    switch (kind) {
      case 'participants':
        return this.participants(hackathon);
      case 'projets':
        return this.projects(hackathon);
      case 'resultats':
        return this.results(hackathon);
      case 'retours':
        return this.feedbackCsv(hackathon);
    }
  }

  fileName(hackathon: Hackathon, kind: CsvExport): string {
    return `${hackathon.code}-${hackathon.slug}-${kind}.csv`;
  }

  private async participants(hackathon: Hackathon): Promise<string> {
    const participants = await this.registrations.participants(hackathon.id);
    return toCsv(
      ['pseudo', 'equipe', 'inscrit_le'],
      participants.map((p) => [p.pseudo, p.teamName ?? '', p.joinedAt]),
    );
  }

  private async projects(hackathon: Hackathon): Promise<string> {
    const submissions = await this.repos.submissions.filter((s) => s.hackathonId === hackathon.id);
    return toCsv(
      [
        'numero',
        'titre',
        'auteur',
        'type',
        'membres',
        'technos',
        'versions',
        'statut',
        'depot_le',
        'dossier_source',
      ],
      submissions
        .sort((a, b) => a.number - b.number)
        .map((s) => [
          String(s.number).padStart(2, '0'),
          s.title,
          s.ownerPseudo,
          s.ownerType === 'team' ? 'équipe' : 'solo',
          s.teamMembers.join(' · '),
          s.techStack.join(' · '),
          s.versions.length,
          s.status,
          s.updatedAt,
          s.files.sourcePath,
        ]),
    );
  }

  private async results(hackathon: Hackathon): Promise<string> {
    const results = await this.evaluations.results(hackathon, true);
    const criteria = hackathon.criteria;
    return toCsv(
      [
        'rang',
        'projet',
        'auteur',
        'membres',
        'score_sur_100',
        'notes_jury',
        'votes_public',
        'prix',
        ...criteria.map((c) => `${c.label} (/${c.maxScore})`),
      ],
      results.entries.map((e) => [
        e.rank,
        e.title,
        e.ownerPseudo,
        e.teamMembers.join(' · '),
        e.score ?? '',
        e.evaluationCount,
        e.publicVotes,
        e.prize ?? '',
        ...criteria.map((c) => e.byCriterion[c.id] ?? ''),
      ]),
    );
  }

  private async feedbackCsv(hackathon: Hackathon): Promise<string> {
    const summary = await this.feedback.summary(hackathon, undefined, true);
    return toCsv(
      ['note', 'reviendrait', 'a_aime', 'a_ameliorer', 'le'],
      summary.comments.map((c) => [
        c.rating,
        c.wouldReturn ? 'oui' : 'non',
        c.liked,
        c.improve,
        c.at,
      ]),
    );
  }
}
