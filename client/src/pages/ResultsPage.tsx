import type { ResultEntry } from '@hackametz/shared';
import { TIE_BREAK_LABELS } from '@hackametz/shared';
import { ArrowLeft, Award, Heart, MessageSquareQuote, Trophy, Users } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ExportMenu } from '@/components/admin/ExportMenu';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th } from '@/components/ui/table';
import { useResults } from '@/hooks/useEvaluations';
import { useHackathon } from '@/hooks/useHackathons';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';
import { NotFoundPage } from './NotFoundPage';

const PODIUM_STYLES = [
  'from-[#f5a524]/30 to-transparent border-[#f5a524]/60',
  'from-slate-400/30 to-transparent border-slate-400/60',
  'from-amber-700/25 to-transparent border-amber-700/50',
];

export function ResultsPage() {
  const { slug = '' } = useParams();
  const { isAdmin } = useSession();
  const { data: h, isPending } = useHackathon(slug);
  const { data: results } = useResults(slug);

  if (isPending)
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
  if (!h) return <NotFoundPage what="Ce hackathon" />;

  const entries = results?.entries ?? [];
  const ranked = entries.filter((e) => e.score !== null && e.status !== 'disqualified');
  // Rappel de la règle de départage, utile seulement s'il y a réellement des scores identiques.
  const scores = ranked.map((e) => e.score);
  const hasTie = scores.some((score, i) => score !== null && scores.indexOf(score) !== i);
  const tieBreakLabel = TIE_BREAK_LABELS[h.tieBreak?.mode ?? 'publicVote'];

  const podium = ranked.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <Link
        to={`/hackathons/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {h.title}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Trophy className="size-4" /> Résultats
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{h.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <StatusBadge status={h.status} />
            {results && (
              <span>
                {results.juryCount} juré{results.juryCount > 1 ? 's' : ''}
              </span>
            )}
            {results && !results.published && isAdmin && (
              <Badge variant="warning">Provisoire — visible par toi seulement</Badge>
            )}
          </div>
        </div>
        {isAdmin && <ExportMenu slug={h.slug} />}
      </header>

      {results && !results.published && !isAdmin && (
        <EmptyState
          icon={Award}
          title="Les résultats ne sont pas encore publiés"
          description={
            h.status === 'judging'
              ? 'Le jury délibère. Le classement s’affichera ici dès que l’édition sera terminée.'
              : 'Le classement apparaît ici une fois le hackathon terminé.'
          }
        />
      )}

      {results && (results.published || isAdmin) && ranked.length === 0 && (
        <EmptyState
          icon={Award}
          title="Aucun projet noté pour l’instant"
          description="Le classement se remplit au fur et à mesure que le jury enregistre ses notes."
        />
      )}

      {podium.length > 0 && (
        <section
          className={cn(
            'grid gap-4',
            podium.length === 1
              ? 'md:max-w-md'
              : podium.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-3',
          )}
        >
          {podium.map((e, i) => (
            <Link
              key={e.submissionId}
              to={`/hackathons/${slug}/projects/${e.submissionId}`}
              className={cn(
                'relative rounded-2xl border bg-gradient-to-b p-6 transition-shadow hover:shadow-md',
                PODIUM_STYLES[i],
                podium.length === 3 && i === 0 && 'md:order-2',
                podium.length === 3 && i === 1 && 'md:order-1',
                podium.length === 3 && i === 2 && 'md:order-3',
              )}
            >
              <span className="font-mono text-4xl font-bold tabular-nums">#{e.rank}</span>
              <h2 className="mt-2 text-lg font-semibold leading-tight">{e.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                {e.ownerType === 'team' && <Users className="size-3.5" />} {e.ownerPseudo}
                {e.teamMembers.length > 0 && (
                  <span className="truncate">· {e.teamMembers.join(', ')}</span>
                )}
              </p>
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
                {e.score} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
              </p>
              {e.prize && <Badge className="mt-2 bg-brand text-white">{e.prize}</Badge>}
            </Link>
          ))}
        </section>
      )}

      {results?.publicFavorite &&
        (() => {
          const fav = entries.find((e) => e.submissionId === results.publicFavorite?.submissionId);
          if (!fav) return null;
          return (
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-2/30 bg-brand-2/5 p-5">
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand text-white">
                <Heart className="size-6 fill-current" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-2">
                  Coup de cœur du public
                </p>
                <Link
                  to={`/hackathons/${slug}/projects/${fav.submissionId}`}
                  className="text-lg font-semibold hover:text-primary"
                >
                  {fav.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {fav.ownerPseudo} · {results.publicFavorite.votes} vote
                  {results.publicFavorite.votes > 1 ? 's' : ''} des participants
                </p>
              </div>
            </section>
          );
        })()}

      {ranked.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Classement complet</h2>
            {hasTie && (
              <p className="text-xs text-muted-foreground">
                Ex æquo départagés par&nbsp;: {tieBreakLabel.toLowerCase()}
              </p>
            )}
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Rang</Th>
                <Th>Projet</Th>
                <Th>Auteur</Th>
                {h.criteria.map((c) => (
                  <Th key={c.id} className="text-right">
                    {c.label}
                    <span className="ml-1 font-normal normal-case">/{c.maxScore}</span>
                  </Th>
                ))}
                <Th className="text-right">Score</Th>
                <Th>Jurés</Th>
                <Th className="text-right">Public</Th>
                <Th>Prix</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <ResultRow
                  key={e.submissionId}
                  entry={e}
                  slug={slug}
                  criteriaIds={h.criteria.map((c) => c.id)}
                />
              ))}
            </tbody>
          </Table>
        </section>
      )}

      {results?.published && entries.some((e) => e.comments.length > 0) && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <MessageSquareQuote className="size-5" /> Retours du jury
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {entries
              .filter((e) => e.comments.length > 0)
              .map((e) => (
                <div key={e.submissionId} className="rounded-xl border bg-card p-5">
                  <p className="font-medium">
                    {e.title}{' '}
                    <span className="text-sm text-muted-foreground">· {e.ownerPseudo}</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {e.comments.map((c, i) => (
                      <li key={i} className="border-l-2 border-primary/40 pl-3">
                        <span className="text-muted-foreground">{c.juryPseudo} :</span> {c.comment}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultRow({
  entry: e,
  slug,
  criteriaIds,
}: {
  entry: ResultEntry;
  slug: string;
  criteriaIds: string[];
}) {
  const out = e.status === 'disqualified';
  return (
    <tr className={cn('hover:bg-accent/30', out && 'opacity-60')}>
      <Td className="font-mono">{out ? '—' : e.score === null ? '·' : e.rank}</Td>
      <Td>
        <Link
          to={`/hackathons/${slug}/projects/${e.submissionId}`}
          className="font-medium hover:text-primary"
        >
          {e.title}
        </Link>
        {out && (
          <Badge variant="danger" className="ml-2">
            Disqualifié
          </Badge>
        )}
      </Td>
      <Td className="text-muted-foreground">{e.ownerPseudo}</Td>
      {criteriaIds.map((id) => (
        <Td key={id} className="text-right font-mono tabular-nums">
          {e.byCriterion[id] ?? '·'}
        </Td>
      ))}
      <Td className="text-right font-mono font-semibold tabular-nums">{e.score ?? '·'}</Td>
      <Td className="font-mono text-muted-foreground">{e.evaluationCount}</Td>
      <Td className="text-right font-mono tabular-nums text-muted-foreground">{e.publicVotes}</Td>
      <Td className="text-sm">{e.prize ?? ''}</Td>
    </tr>
  );
}
