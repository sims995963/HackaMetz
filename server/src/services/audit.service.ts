import type { AuditEntry } from '@hackametz/shared';
import type { Repositories } from '../repositories';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

/** Au-delà, les plus anciennes sont oubliées : ce journal sert à comprendre la soirée, pas à archiver. */
const MAX_ENTRIES = 2000;

/** Traduit une route en phrase lisible dans le dashboard. */
const LABELS: { test: RegExp; method?: string; label: string }[] = [
  { test: /^\/hackathons$/, method: 'POST', label: 'Création d’un hackathon' },
  { test: /^\/hackathons\/[^/]+\/status$/, label: 'Changement de statut' },
  { test: /^\/hackathons\/[^/]+$/, method: 'PATCH', label: 'Modification d’un hackathon' },
  {
    test: /^\/hackathons\/[^/]+\/announcements/,
    method: 'POST',
    label: 'Publication d’une annonce',
  },
  {
    test: /^\/hackathons\/[^/]+\/announcements/,
    method: 'DELETE',
    label: 'Suppression d’une annonce',
  },
  { test: /^\/hackathons\/[^/]+\/jury$/, label: 'Désignation du jury' },
  { test: /^\/hackathons\/[^/]+\/questions\/[^/]+\/answer$/, label: 'Réponse à une question' },
  {
    test: /^\/hackathons\/[^/]+\/questions\/[^/]+$/,
    method: 'DELETE',
    label: 'Retrait d’une question',
  },
  { test: /^\/hackathons\/[^/]+\/exports\//, label: 'Export CSV' },
  { test: /^\/submissions\/[^/]+\/status$/, label: 'Disqualification ou rétablissement' },
  { test: /^\/admin\/users\/[^/]+\/release$/, label: 'Libération d’un pseudo' },
  { test: /^\/admin\/kb\/export$/, label: 'Export de la base de connaissance' },
  { test: /^\/proposals\/[^/]+\/status$/, label: 'Ouverture ou clôture d’un tour' },
  { test: /^\/proposals/, method: 'POST', label: 'Création d’un tour de propositions' },
  { test: /^\/proposals/, method: 'PATCH', label: 'Modification d’un tour' },
  { test: /^\/proposals/, method: 'DELETE', label: 'Suppression d’un tour' },
];

export function labelFor(method: string, path: string): string {
  const match = LABELS.find((l) => l.test.test(path) && (!l.method || l.method === method));
  return match?.label ?? `${method} ${path}`;
}

/**
 * Journal des actions d'organisateur : qui a fait quoi, quand. Utile le lendemain,
 * quand une équipe conteste une disqualification ou un changement de deadline.
 */
export class AuditService {
  constructor(private readonly repos: Repositories) {}

  async record(entry: Omit<AuditEntry, 'id' | 'at' | 'label'>): Promise<void> {
    await this.repos.audit.insert({
      ...entry,
      id: newId(),
      at: nowIso(),
      label: labelFor(entry.method, entry.path),
    });
    const all = await this.repos.audit.all();
    if (all.length <= MAX_ENTRIES) return;
    const oldest = all.sort((a, b) => a.at.localeCompare(b.at)).slice(0, all.length - MAX_ENTRIES);
    for (const item of oldest) await this.repos.audit.remove(item.id);
  }

  /** De la plus récente à la plus ancienne. */
  async list(limit = 50): Promise<{ entries: AuditEntry[]; total: number }> {
    const all = await this.repos.audit.all();
    const entries = all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
    return { entries, total: all.length };
  }
}
