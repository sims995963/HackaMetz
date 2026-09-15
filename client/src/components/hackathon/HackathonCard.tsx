import type { HackathonWithCounts } from '@hackametz/shared';
import { HACKATHON_FORMAT_LABELS } from '@hackametz/shared';
import { ArrowRight, FolderArchive, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { formatRange } from '@/lib/dates';
import { Countdown } from './Countdown';
import { StatusBadge } from './StatusBadge';

export function HackathonCard({ hackathon: h }: { hackathon: HackathonWithCounts }) {
  const showDeadline = h.status === 'running';
  const showStart = h.status === 'published';

  return (
    <Link
      to={`/hackathons/${h.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="h-1.5"
        style={{
          background: `linear-gradient(90deg, ${h.coverColor}, color-mix(in oklab, ${h.coverColor} 55%, var(--brand-2)))`,
        }}
        aria-hidden
      />
      {/* Halo aux couleurs de l'édition, révélé au survol. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(70% 100% at 50% 0%, color-mix(in oklab, ${h.coverColor} 16%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-xs font-medium text-muted-foreground">#{h.code}</span>
          <StatusBadge status={h.status} />
        </div>
        <div>
          <h3 className="text-lg font-semibold leading-tight tracking-tight group-hover:text-primary">
            {h.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.theme}</p>
        </div>
        <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Dates</dt>
            <dd>{formatRange(h.dates.startsAt, h.dates.endsAt)}</dd>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            <dt className="sr-only">Format</dt>
            <dd>{HACKATHON_FORMAT_LABELS[h.format]}</dd>
          </div>
          {h.team.enabled && (
            <div className="flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              <dt className="sr-only">Équipes</dt>
              <dd>
                {h.team.minSize === h.team.maxSize
                  ? `équipes de ${h.team.maxSize}`
                  : `équipes de ${h.team.minSize} à ${h.team.maxSize}`}
              </dd>
            </div>
          )}
        </dl>
        {h.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {h.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {h.counts.participants} inscrit
            {h.counts.participants > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1">
            <FolderArchive className="size-3.5" aria-hidden /> {h.counts.submissions} projet
            {h.counts.submissions > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          {showDeadline && (
            <Countdown compact targetIso={h.dates.submissionDeadlineAt} label="Dépôt dans" />
          )}
          {showStart && <Countdown compact targetIso={h.dates.startsAt} label="Début dans" />}
          {!showDeadline && !showStart && (
            <span className="text-xs text-muted-foreground">Voir le hackathon</span>
          )}
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
}
