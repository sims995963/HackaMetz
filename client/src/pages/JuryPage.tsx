import { useEffect, useState } from 'react';
import type { Criterion, Submission } from '@hackametz/shared';
import { ArrowLeft, Check, ClipboardList, ExternalLink, Save } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { useIsJuror, useMyEvaluations, useUpsertEvaluation } from '@/hooks/useEvaluations';
import { useHackathon } from '@/hooks/useHackathons';
import { useSubmissions } from '@/hooks/useParticipation';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';
import { NotFoundPage } from './NotFoundPage';

/** Grille de notation : un projet à la fois, une note par critère, un commentaire. */
export function JuryPage() {
  const { slug = '' } = useParams();
  const { isLoggedIn } = useSession();
  const { data: h, isPending } = useHackathon(slug);
  const isJuror = useIsJuror(slug);
  const { data: submissions } = useSubmissions(slug);
  const { data: mine } = useMyEvaluations(slug, isJuror);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isPending)
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
  if (!h) return <NotFoundPage what="Ce hackathon" />;

  if (!isLoggedIn || !isJuror) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ClipboardList className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Espace jury</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLoggedIn
            ? 'Ton pseudo ne fait pas partie du jury de ce hackathon. L’organisateur peut t’ajouter depuis le formulaire du hackathon.'
            : 'Entre avec ton pseudo de juré pour accéder à la grille de notation.'}
        </p>
        <Link
          to={`/hackathons/${slug}`}
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}
        >
          Retour au hackathon
        </Link>
      </div>
    );
  }

  const gradable = (submissions ?? []).filter((s) => s.status !== 'disqualified');
  const selected = gradable.find((s) => s.id === selectedId) ?? gradable[0];
  const graded = new Set((mine ?? []).map((e) => e.submissionId));
  const closed = !['running', 'submissions_closed', 'judging'].includes(h.status);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={`/hackathons/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {h.title}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand">Jury</p>
          <h1 className="text-3xl font-bold tracking-tight">Noter les projets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {graded.size} / {gradable.length} projets notés · {h.criteria.length} critères pondérés
            {closed && ' · notation close, résultats publiés'}
          </p>
        </div>
        <Link to={`/hackathons/${slug}/results`} className={buttonVariants({ variant: 'outline' })}>
          Voir le classement
        </Link>
      </header>

      {h.criteria.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun critère d’évaluation"
          description="L’organisateur doit en ajouter dans le formulaire du hackathon avant que le jury puisse noter."
        />
      ) : gradable.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucun projet à noter"
          description="Les projets déposés apparaîtront ici dès qu’il y en aura."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="self-start lg:sticky lg:top-6">
            <div className="mb-2 rounded-xl border border-border/70 bg-card p-3">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium">Progression</span>
                <span className="font-mono text-muted-foreground">
                  {graded.size}/{gradable.length}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{
                    width: `${gradable.length === 0 ? 0 : (graded.size / gradable.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <ol className="flex flex-col gap-1 rounded-xl border border-border/70 bg-card p-2">
              {gradable.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent',
                      selected?.id === s.id && 'bg-accent font-medium',
                    )}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(s.number).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{s.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.ownerPseudo}
                      </span>
                    </span>
                    {graded.has(s.id) && (
                      <Check className="size-4 text-success" aria-label="Noté" />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {selected && (
            <GradeForm
              key={selected.id}
              slug={slug}
              submission={selected}
              criteria={h.criteria}
              existing={mine?.find((e) => e.submissionId === selected.id)}
              closed={closed}
              onSaved={() => {
                const index = gradable.findIndex((s) => s.id === selected.id);
                const next = gradable[index + 1];
                if (next && !graded.has(next.id)) setSelectedId(next.id);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Jauge circulaire du score pondéré : lecture instantanée pendant la notation. */
function ScoreRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <span className="relative inline-flex size-16 items-center justify-center">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="url(#score-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.35s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
        <defs>
          <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-1)" />
            <stop offset="55%" stopColor="var(--brand-2)" />
            <stop offset="100%" stopColor="var(--brand-3)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-mono text-sm font-semibold tabular-nums">
        {Math.round(value)}
      </span>
      <span className="sr-only">{value} sur 100</span>
    </span>
  );
}

interface GradeFormProps {
  slug: string;
  submission: Submission;
  criteria: Criterion[];
  existing?: { scores: Record<string, number>; comment: string };
  closed: boolean;
  onSaved: () => void;
}

function GradeForm({ slug, submission: s, criteria, existing, closed, onSaved }: GradeFormProps) {
  const upsert = useUpsertEvaluation(slug);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');

  useEffect(() => {
    setScores(
      existing?.scores ??
        Object.fromEntries(criteria.map((c) => [c.id, Math.ceil(c.maxScore / 2)])),
    );
    setComment(existing?.comment ?? '');
  }, [existing, criteria]);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const preview =
    totalWeight === 0
      ? 0
      : Math.round(
          (criteria.reduce((sum, c) => sum + ((scores[c.id] ?? 0) / c.maxScore) * c.weight, 0) /
            totalWeight) *
            1000,
        ) / 10;

  async function save() {
    try {
      await upsert.mutateAsync({ submissionId: s.id, input: { scores, comment } });
      toast.success(`Note enregistrée pour « ${s.title} »`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            projet #{String(s.number).padStart(2, '0')} · {s.ownerPseudo}
          </p>
          <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
          {s.pitch && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{s.pitch}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.techStack.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        <Link
          to={`/hackathons/${slug}/projects/${s.id}`}
          target="_blank"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Ouvrir le code <ExternalLink />
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {criteria.map((c) => {
          const value = scores[c.id] ?? 0;
          return (
            <div key={c.id}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`score-${c.id}`} className="text-sm font-medium">
                  {c.label}{' '}
                  <span className="font-normal text-muted-foreground">· poids ×{c.weight}</span>
                </label>
                <span className="font-mono text-sm tabular-nums">
                  <span className="text-base font-semibold text-foreground">{value}</span>
                  <span className="text-muted-foreground"> / {c.maxScore}</span>
                </span>
              </div>
              {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              <input
                id={`score-${c.id}`}
                type="range"
                min={0}
                max={c.maxScore}
                step={c.maxScore >= 10 ? 1 : 0.5}
                value={value}
                disabled={closed}
                onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                className="range-brand mt-2"
                style={
                  {
                    '--range-percent': `${c.maxScore === 0 ? 0 : (value / c.maxScore) * 100}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          );
        })}
        <div>
          <label htmlFor="comment" className="text-sm font-medium">
            Commentaire pour le candidat (optionnel)
          </label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={closed}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-4">
        <div className="flex items-center gap-3">
          <ScoreRing value={preview} />
          <div>
            <p className="text-sm font-medium">Score pondéré</p>
            <p className="text-xs text-muted-foreground">moyenne des critères, ramenée sur 100</p>
          </div>
        </div>
        <Button onClick={save} disabled={closed || upsert.isPending}>
          <Save /> {existing ? 'Mettre à jour la note' : 'Enregistrer la note'}
        </Button>
      </div>
    </section>
  );
}
