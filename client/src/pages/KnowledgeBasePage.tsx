import { useEffect, useMemo, useState } from 'react';
import type { KbProject } from '@hackametz/shared';
import {
  ArrowDownAZ,
  ArrowRight,
  Clock,
  FileCode2,
  FolderArchive,
  Layers,
  Search,
  SearchX,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu';
import { CardSkeleton } from '@/components/ui/skeleton';
import { useHackathons } from '@/hooks/useHackathons';
import { useKbProjects } from '@/hooks/useKb';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Sort = 'recent' | 'title' | 'rank';
const SORT_LABELS: Record<Sort, string> = {
  recent: 'Plus récents',
  title: 'Titre A → Z',
  rank: 'Mieux classés',
};
const SORT_ICONS: Record<Sort, typeof Clock> = { recent: Clock, title: ArrowDownAZ, rank: Trophy };

/** Galerie de tous les projets archivés, filtrable par texte, techno et édition. */
export function KnowledgeBasePage() {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [q, setQ] = useState(urlQuery);
  const [tech, setTech] = useState('');
  const [hackathon, setHackathon] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  useEffect(() => setQ(urlQuery), [urlQuery]);

  const { data, isPending } = useKbProjects({
    q: q.trim() || undefined,
    tech: tech || undefined,
    hackathon: hackathon || undefined,
  });
  const { data: hackathons } = useHackathons();
  const editions = (hackathons ?? []).filter((h) => h.status !== 'draft');
  const filtered = Boolean(q.trim() || tech || hackathon);

  const projects = useMemo(() => {
    const list = [...(data?.projects ?? [])];
    if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    if (sort === 'rank') list.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    return list;
  }, [data, sort]);

  const technologies = data?.technologies ?? [];
  const topTech = technologies.slice(0, 10);
  const moreTech = technologies.slice(10);
  const SortIcon = SORT_ICONS[sort];

  function clear() {
    setQ('');
    setTech('');
    setHackathon('');
    if (params.has('q')) setParams({});
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ------------------------------------------------------------ En-tête + recherche */}
      <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card p-7 shadow-soft sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(50% 80% at 100% 0%, var(--glow-2), transparent 70%), radial-gradient(40% 60% at 0% 100%, var(--glow-3), transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand">
              <FolderArchive className="size-4" /> Base de connaissance
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Tous les projets, édition après édition
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Chaque dépôt vit dans un dossier numéroté avec son code, son archive d’origine et son
              manifest — le tout versionné sur Git. Cherche par titre, pitch, auteur ou techno.
            </p>
            <div className="relative mt-6">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-12 rounded-xl pl-12 pr-10 text-base"
                placeholder="Rechercher un projet, un auteur, une techno…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Rechercher"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Effacer"
                  onClick={() => setQ('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Stat icon={FileCode2} value={data ? data.projects.length : '·'} label="projets" />
            <Stat icon={Layers} value={data ? technologies.length : '·'} label="technos" />
            <Stat icon={FolderArchive} value={editions.length} label="éditions" />
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ Filtres */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <SlidersHorizontal className="size-3.5" /> Technos
          </span>
          <Chip active={tech === ''} onClick={() => setTech('')}>
            Toutes
          </Chip>
          {topTech.map((t) => (
            <Chip key={t} active={tech === t} onClick={() => setTech(tech === t ? '' : t)}>
              {t}
            </Chip>
          ))}
          {moreTech.length > 0 && (
            <Menu
              trigger={({ open, toggle }) => (
                <Chip active={moreTech.includes(tech)} onClick={toggle} aria-expanded={open}>
                  {moreTech.includes(tech) ? tech : `+ ${moreTech.length} autres`}
                </Chip>
              )}
            >
              <MenuLabel>Autres technos</MenuLabel>
              <div className="max-h-64 overflow-y-auto">
                {moreTech.map((t) => (
                  <MenuItem key={t} onClick={() => setTech(t)}>
                    {t}
                  </MenuItem>
                ))}
              </div>
            </Menu>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderArchive className="size-3.5" /> Édition
          </span>
          <Chip active={hackathon === ''} onClick={() => setHackathon('')}>
            Toutes
          </Chip>
          {editions.map((h) => (
            <Chip
              key={h.id}
              active={hackathon === h.slug}
              onClick={() => setHackathon(hackathon === h.slug ? '' : h.slug)}
              color={h.coverColor}
            >
              #{h.code} {h.title}
            </Chip>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Projets */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Projets</h2>
            <span className="font-mono text-xs text-muted-foreground">{projects.length}</span>
            {filtered && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={clear}
              >
                <X className="size-3" /> Effacer les filtres
              </button>
            )}
          </div>
          <Menu
            trigger={({ open, toggle }) => (
              <Button variant="outline" size="sm" aria-expanded={open} onClick={toggle}>
                <SortIcon /> {SORT_LABELS[sort]}
              </Button>
            )}
          >
            <MenuLabel>Trier</MenuLabel>
            {(Object.keys(SORT_LABELS) as Sort[]).map((s) => {
              const Icon = SORT_ICONS[s];
              return (
                <MenuItem
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(sort === s && 'bg-accent')}
                >
                  <Icon /> {SORT_LABELS[s]}
                </MenuItem>
              );
            })}
          </Menu>
        </div>

        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={filtered ? SearchX : FolderArchive}
            title={filtered ? 'Aucun projet ne correspond' : 'La base est encore vide'}
            description={
              filtered
                ? 'Essaie une autre techno, une autre édition, ou efface les filtres.'
                : 'Chaque projet déposé pendant un hackathon atterrit ici, avec son code et son archive.'
            }
            action={
              filtered ? (
                <Button variant="outline" onClick={clear}>
                  <X /> Effacer les filtres
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Éditions */}
      <section>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">Éditions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {editions.map((h) => (
            <Link
              key={h.id}
              to={`/hackathons/${h.slug}`}
              className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
            >
              <div
                className="relative h-20"
                style={{
                  background: `linear-gradient(120deg, ${h.coverColor}, color-mix(in oklab, ${h.coverColor} 55%, #0b1020))`,
                }}
              >
                <span className="absolute right-4 top-2 font-display text-5xl font-bold text-white/15">
                  {h.code}
                </span>
                <StatusBadge
                  status={h.status}
                  className="absolute left-4 top-4 bg-white/90 text-[#141a2a]"
                />
              </div>
              <div className="p-5">
                <h3 className="font-semibold group-hover:text-primary">{h.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{h.theme}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatDate(h.dates.startsAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {h.counts.participants}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileCode2 className="size-3.5" /> {h.counts.submissions}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Clock;
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <Icon className="size-4 text-muted-foreground" />
      <dd className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}

function Chip({
  active,
  color,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; color?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all',
        active
          ? 'border-transparent bg-brand text-white shadow-soft'
          : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {color && (
        <span
          className={cn('size-2 rounded-full', active && 'ring-2 ring-white/60')}
          style={{ background: color }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

function ProjectCard({ project: p }: { project: KbProject }) {
  const known = new Set(p.techStack.map((t) => t.toLowerCase()));
  const languages = Object.entries(p.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l)
    .filter((l) => !known.has(l.toLowerCase()))
    .slice(0, 2);
  return (
    <Link
      to={`/hackathons/${p.hackathon.slug}/projects/${p.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift',
        p.rank === 1 && 'border-brand-3/50',
      )}
    >
      <div className="h-1.5" style={{ background: p.hackathon.coverColor }} aria-hidden />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            #{p.hackathon.code} · {p.hackathon.title}
          </span>
          {p.rank && (
            <Badge
              className={cn('shrink-0', p.rank === 1 && 'bg-brand text-white')}
              variant={p.rank === 1 ? 'default' : 'secondary'}
            >
              <Trophy className="size-3" /> {p.rank === 1 ? 'Vainqueur' : `#${p.rank}`}
            </Badge>
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
            {p.title}
          </h3>
          {p.pitch && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.pitch}</p>}
        </div>
        <p className="flex items-center gap-1.5 text-sm">
          {p.ownerType === 'team' && <Users className="size-3.5 text-muted-foreground" />}
          <span className="font-medium">{p.ownerPseudo}</span>
          {p.teamMembers.length > 0 && (
            <span className="truncate text-xs text-muted-foreground">
              {p.teamMembers.join(', ')}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {p.techStack.slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
          {languages.map((l) => (
            <Badge key={l} variant="outline" className="font-normal text-muted-foreground">
              {l}
            </Badge>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileCode2 className="size-3.5" /> {p.fileCount} fichiers
          </span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
}
