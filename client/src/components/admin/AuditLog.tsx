import { useState } from 'react';
import { ChevronDown, ScrollText } from 'lucide-react';
import { useAudit } from '@/hooks/useAudit';
import { formatDateTime, fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Verbes qui méritent qu'on les repère du coin de l'œil. */
const TONE: { match: RegExp; className: string }[] = [
  { match: /Disqualification|Suppression|Retrait|Libération/, className: 'text-destructive' },
  { match: /Création|Publication|Ouverture/, className: 'text-brand-1' },
];

export function AuditLog({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const { data } = useAudit(enabled && open);

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <ScrollText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">Journal de l’organisateur</span>
          <span className="block text-sm text-muted-foreground">
            Qui a publié, disqualifié, exporté — et quand.
          </span>
        </span>
        {data && <span className="font-mono text-xs text-muted-foreground">{data.total}</span>}
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 py-4">
          {!data ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune action enregistrée pour l’instant.
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-border/60 text-sm">
              {data.entries.map((entry) => {
                const tone = TONE.find((t) => t.match.test(entry.label))?.className;
                return (
                  <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                    <span className={cn('font-medium', tone)}>{entry.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.path}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {entry.actorPseudo ? `${entry.actorPseudo} · ` : ''}
                      <time dateTime={entry.at} title={formatDateTime(entry.at)}>
                        {fromNow(entry.at)}
                      </time>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
