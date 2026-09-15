import type { HackathonStatus, HackathonWithCounts } from '@hackametz/shared';
import { HACKATHON_FORMAT_LABELS } from '@hackametz/shared';
import {
  ArrowRight,
  CalendarDays,
  FolderArchive,
  MapPin,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { Countdown } from '@/components/hackathon/Countdown';
import { HackathonCard } from '@/components/hackathon/HackathonCard';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useHackathons } from '@/hooks/useHackathons';
import { usePublicStats } from '@/hooks/useStats';
import { formatRange } from '@/lib/dates';

interface GroupDef {
  title: string;
  statuses: HackathonStatus[];
  hint: string;
  /** Les éditions passées se lisent mieux en lignes compactes qu'en grandes cartes. */
  layout: 'grid' | 'list';
}

const GROUPS: GroupDef[] = [
  {
    title: 'En cours',
    statuses: ['running', 'submissions_closed', 'judging'],
    hint: 'Dépose ton projet avant la deadline.',
    layout: 'grid',
  },
  { title: 'À venir', statuses: ['published'], hint: 'Inscriptions ouvertes.', layout: 'grid' },
  {
    title: 'Éditions passées',
    statuses: ['finished', 'archived'],
    hint: 'Résultats et projets archivés dans la base de connaissance.',
    layout: 'list',
  },
  {
    title: 'Brouillons',
    statuses: ['draft'],
    hint: 'Visibles uniquement par l’organisateur.',
    layout: 'list',
  },
];

/** Édition à mettre en avant : celle qui tourne, sinon la prochaine à démarrer. */
function pickFeatured(hackathons: HackathonWithCounts[]): HackathonWithCounts | undefined {
  const running = hackathons
    .filter((h) => h.status === 'running')
    .sort((a, b) => a.dates.submissionDeadlineAt.localeCompare(b.dates.submissionDeadlineAt));
  if (running[0]) return running[0];
  return hackathons
    .filter((h) => h.status === 'published')
    .sort((a, b) => a.dates.startsAt.localeCompare(b.dates.startsAt))[0];
}

export function HackathonsPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useHackathons();
  const { data: stats } = usePublicStats();
  const featured = data ? pickFeatured(data) : undefined;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Trophy className="size-4" /> Toutes les éditions
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Hackathons
          </h1>
          <p className="mt-2 text-muted-foreground">
            Rejoins une édition, glisse-dépose ton projet avant la deadline, retrouve-le ensuite
            dans la base de connaissance.
          </p>
        </div>
        {stats && (
          <dl className="flex gap-2">
            <HeaderStat value={stats.hackathons} label="éditions" />
            <HeaderStat value={stats.participants} label="participants" />
            <HeaderStat value={stats.submissions} label="projets" />
          </dl>
        )}
      </section>

      {isPending && (
        <div className="flex flex-col gap-8" aria-busy="true" aria-label="Chargement">
          <div className="h-56 animate-pulse rounded-[28px] border border-border/70 bg-card" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <p className="font-medium text-destructive">Impossible de charger les hackathons</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? 'animate-spin' : ''} /> Réessayer
          </Button>
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="Aucun hackathon pour le moment"
          description="L’organisateur créera la première édition depuis le dashboard. En attendant, les idées se votent côté propositions."
          action={
            <Link to="/propositions" className={buttonVariants({ variant: 'outline' })}>
              <Sparkles /> Voir les propositions
            </Link>
          }
        />
      )}

      {featured && <FeaturedCard hackathon={featured} />}

      {data &&
        data.length > 0 &&
        GROUPS.map((group) => (
          <Group key={group.title} {...group} hackathons={data} excludeId={featured?.id} />
        ))}
    </div>
  );
}

function HeaderStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 px-4 py-2 text-center shadow-soft">
      <dd className="font-display text-xl font-bold leading-none">{value}</dd>
      <dt className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    </div>
  );
}

/** Grande carte de tête : l'édition en cours (ou la prochaine) avec son compte à rebours. */
function FeaturedCard({ hackathon: h }: { hackathon: HackathonWithCounts }) {
  const running = h.status === 'running';
  const target = running
    ? { iso: h.dates.submissionDeadlineAt, label: 'Deadline de dépôt' }
    : { iso: h.dates.startsAt, label: 'Début dans' };

  return (
    <section className="group relative overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-lift transition-shadow hover:shadow-pop">
      <div
        className="relative flex min-h-24 items-end overflow-hidden px-5 pb-3.5 sm:min-h-28 sm:px-8"
        style={{
          background: `linear-gradient(120deg, ${h.coverColor}, color-mix(in oklab, ${h.coverColor} 55%, #0b1020))`,
        }}
      >
        <span
          className="pointer-events-none absolute -right-2 -top-4 select-none font-mono text-[7rem] font-bold leading-none text-white/10 sm:text-[9rem]"
          aria-hidden
        >
          {h.code}
        </span>
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-[#141a2a]">
            {running ? 'En cours' : 'Prochaine édition'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs text-white backdrop-blur">
            <MapPin className="size-3.5" /> {HACKATHON_FORMAT_LABELS[h.format]}
            {h.location && ` · ${h.location}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-xs text-white backdrop-blur">
            <CalendarDays className="size-3.5" /> {formatRange(h.dates.startsAt, h.dates.endsAt)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.5fr_auto] lg:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{h.title}</h2>
          <p className="mt-1.5 max-w-2xl text-muted-foreground">{h.theme}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {h.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
          <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="size-4" />
              <dt className="sr-only">Inscrits</dt>
              <dd>
                <strong className="font-semibold text-foreground">{h.counts.participants}</strong>{' '}
                inscrit{h.counts.participants > 1 ? 's' : ''}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <FolderArchive className="size-4" />
              <dt className="sr-only">Projets</dt>
              <dd>
                <strong className="font-semibold text-foreground">{h.counts.submissions}</strong>{' '}
                projet{h.counts.submissions > 1 ? 's' : ''}
              </dd>
            </div>
            {h.team.enabled && (
              <div className="flex items-center gap-1.5">
                <Users className="size-4" />
                <dt className="sr-only">Équipes</dt>
                <dd>
                  {h.team.minSize}–{h.team.maxSize} par équipe
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-col items-start gap-4 lg:items-end">
          <div className="w-full rounded-2xl border border-border/70 bg-background/70 px-5 py-4 lg:w-auto">
            <Countdown targetIso={target.iso} label={target.label} />
          </div>
          <Link
            to={`/hackathons/${h.slug}`}
            className={buttonVariants({ size: 'lg', className: 'w-full lg:w-auto' })}
          >
            {running ? 'Participer' : 'Voir l’édition'}
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Group({
  title,
  statuses,
  hint,
  layout,
  hackathons,
  excludeId,
}: GroupDef & { hackathons: HackathonWithCounts[]; excludeId?: string }) {
  const items = hackathons
    .filter((h) => statuses.includes(h.status) && h.id !== excludeId)
    .sort((a, b) => b.code.localeCompare(a.code));
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
        <span className="hidden text-sm text-muted-foreground sm:inline">— {hint}</span>
      </div>
      {layout === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((h, index) => (
            <div
              key={h.id}
              className="animate-page-in"
              style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
            >
              <HackathonCard hackathon={h} />
            </div>
          ))}
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          {items.map((h) => (
            <li key={h.id} className="border-b border-border/60 last:border-b-0">
              <PastRow hackathon={h} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Ligne compacte d'une édition passée : pastille de couleur, chiffres, accès aux résultats. */
function PastRow({ hackathon: h }: { hackathon: HackathonWithCounts }) {
  return (
    <Link
      to={`/hackathons/${h.slug}`}
      className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
    >
      <span
        className="h-9 w-1.5 shrink-0 rounded-full"
        style={{ background: h.coverColor }}
        aria-hidden
      />
      <span className="font-mono text-xs text-muted-foreground">#{h.code}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium group-hover:text-primary">{h.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatRange(h.dates.startsAt, h.dates.endsAt)}
          {h.theme && ` · ${h.theme}`}
        </span>
      </span>
      <span className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" /> {h.counts.participants}
        </span>
        <span className="inline-flex items-center gap-1">
          <FolderArchive className="size-3.5" /> {h.counts.submissions}
        </span>
      </span>
      <StatusBadge status={h.status} />
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
