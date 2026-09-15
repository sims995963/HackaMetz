import type { ProposalRoundView } from '@hackametz/shared';
import { PROPOSAL_ROUND_STATUS_LABELS } from '@hackametz/shared';
import {
  ArrowUp,
  Check,
  Lightbulb,
  Lock,
  LogIn,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Rocket,
  Trash2,
  Trophy,
  Vote,
} from 'lucide-react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import type { ShellContext } from '@/components/layout/AppShell';
import { Markdown } from '@/components/markdown/Markdown';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Menu, MenuItem, MenuLabel, MenuLink, MenuSeparator } from '@/components/ui/menu';
import { useProposalAdmin, useProposalRounds, useProposalVote } from '@/hooks/useProposals';
import { useSession } from '@/hooks/useSession';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Tours de propositions : trois idées, un vote par pseudo, la plus votée devient le prochain hackathon. */
export function ProposalsPage() {
  const { isAdmin } = useSession();
  const { data: rounds, isPending } = useProposalRounds();
  const open = rounds?.filter((r) => r.status === 'open') ?? [];
  const others = rounds?.filter((r) => r.status !== 'open') ?? [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Lightbulb className="size-4" /> Propositions
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            Le prochain thème, c’est vous qui le choisissez
          </h1>
          <p className="mt-2 text-muted-foreground">
            L’organisateur propose trois idées de hackathon. Chaque pseudo vote pour une seule ; à
            la clôture, la plus votée devient l’édition suivante.
          </p>
        </div>
        {isAdmin && (
          <Link to="/admin/propositions/new" className={buttonVariants()}>
            <Plus /> Nouveau tour
          </Link>
        )}
      </header>

      {isPending && (
        <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />
      )}

      {open.map((round) => (
        <RoundSection key={round.id} round={round} highlight />
      ))}

      {rounds && open.length === 0 && (
        <EmptyState
          icon={Vote}
          title="Aucun vote ouvert pour le moment"
          description={
            isAdmin
              ? 'Crée un tour de trois propositions, puis ouvre le vote : la plus soutenue devient la prochaine édition.'
              : 'Reviens quand l’organisateur aura lancé un tour — trois idées, un vote par pseudo.'
          }
          action={
            isAdmin ? (
              <Link to="/admin/propositions/new" className={buttonVariants()}>
                <Plus /> Créer un tour
              </Link>
            ) : undefined
          }
        />
      )}

      {others.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-lg font-semibold tracking-tight">Tours précédents</h2>
          {others.map((round) => (
            <RoundSection key={round.id} round={round} />
          ))}
        </section>
      )}
    </div>
  );
}

function RoundSection({ round, highlight }: { round: ProposalRoundView; highlight?: boolean }) {
  const { isLoggedIn, isAdmin } = useSession();
  const { openPseudoDialog } = useOutletContext<ShellContext>();
  const vote = useProposalVote();
  const admin = useProposalAdmin();
  const navigate = useNavigate();
  const isOpen = round.status === 'open';
  const winner = round.proposals.find((p) => p.id === round.winnerProposalId);
  const max = Math.max(1, ...Object.values(round.counts));

  async function castVote(proposalId: string) {
    if (!isLoggedIn) {
      openPseudoDialog();
      return;
    }
    try {
      await vote.mutateAsync({
        roundId: round.id,
        proposalId: round.mine === proposalId ? null : proposalId,
      });
      toast.success(round.mine === proposalId ? 'Vote retiré' : 'Vote enregistré !');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Vote impossible');
    }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Action impossible');
    }
  }

  return (
    <section
      className={cn(
        'rounded-[28px] border bg-card p-6 shadow-soft sm:p-8',
        highlight ? 'border-brand-2/30 ring-brand' : 'border-border/70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              tour {String(round.number).padStart(2, '0')}
            </span>
            <Badge
              variant={isOpen ? 'success' : round.status === 'draft' ? 'outline' : 'secondary'}
            >
              {isOpen && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
              {PROPOSAL_ROUND_STATUS_LABELS[round.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {round.totalVotes} vote{round.totalVotes > 1 ? 's' : ''}
              {round.openedAt && ` · ouvert ${fromNow(round.openedAt)}`}
              {round.closedAt && ` · clôturé ${fromNow(round.closedAt)}`}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{round.title}</h2>
          {round.description && (
            <div className="mt-1 max-w-2xl text-muted-foreground">
              <Markdown>{round.description}</Markdown>
            </div>
          )}
        </div>

        {isAdmin && (
          <Menu
            trigger={({ open, toggle }) => (
              <Button variant="outline" size="sm" aria-expanded={open} onClick={toggle}>
                Gérer <MoreHorizontal />
              </Button>
            )}
          >
            <MenuLabel>Tour {String(round.number).padStart(2, '0')}</MenuLabel>
            {round.status === 'draft' && (
              <MenuItem
                onClick={() =>
                  run(
                    () => admin.setStatus.mutateAsync({ id: round.id, status: 'open' }),
                    'Vote ouvert !',
                  )
                }
              >
                <Play /> Ouvrir le vote
              </MenuItem>
            )}
            {isOpen && (
              <MenuItem
                onClick={() =>
                  run(
                    () => admin.setStatus.mutateAsync({ id: round.id, status: 'closed' }),
                    'Vote clôturé, gagnant désigné',
                  )
                }
              >
                <Lock /> Clôturer et désigner le gagnant
              </MenuItem>
            )}
            {round.status === 'closed' && winner && !round.hackathonId && (
              <MenuItem onClick={() => navigate(`/admin/hackathons/new?round=${round.id}`)}>
                <Rocket /> Créer le hackathon « {winner.title} »
              </MenuItem>
            )}
            {round.status === 'draft' && (
              <MenuLink to={`/admin/propositions/${round.id}/edit`}>
                <Pencil /> Modifier
              </MenuLink>
            )}
            {round.status !== 'open' && (
              <>
                <MenuSeparator />
                <MenuItem
                  destructive
                  onClick={() => run(() => admin.remove.mutateAsync(round.id), 'Tour supprimé')}
                >
                  <Trash2 /> Supprimer
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>

      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {round.proposals.map((p, index) => {
          const count = round.counts[p.id] ?? 0;
          const mine = round.mine === p.id;
          const isWinner = winner?.id === p.id;
          const share = round.totalVotes > 0 ? Math.round((count / round.totalVotes) * 100) : 0;
          return (
            <li
              key={p.id}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-2xl border bg-background/60 transition-all',
                mine && 'border-primary/60 shadow-lift',
                isWinner && 'border-brand-3/60',
                !mine && !isWinner && 'border-border/70',
              )}
            >
              <div className="h-1.5" style={{ background: p.coverColor }} aria-hidden />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {isWinner && (
                    <Badge className="bg-brand text-white">
                      <Trophy className="size-3" /> Retenu
                    </Badge>
                  )}
                  {mine && !isWinner && (
                    <Badge variant="info">
                      <Check className="size-3" /> Mon vote
                    </Badge>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold leading-tight">{p.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.theme}</p>
                </div>
                {p.description && <p className="text-sm leading-relaxed">{p.description}</p>}
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-auto pt-2">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {count} vote{count > 1 ? 's' : ''}
                    </span>
                    <span className="font-mono tabular-nums">{share} %</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500',
                        isWinner || mine ? 'bg-brand' : 'bg-primary/50',
                      )}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </div>
                {isOpen && (
                  <button
                    type="button"
                    onClick={() => castVote(p.id)}
                    disabled={vote.isPending}
                    aria-pressed={mine}
                    className={cn(
                      'mt-1 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all',
                      mine
                        ? 'border-transparent bg-brand text-white shadow-soft'
                        : 'border-border/70 bg-card hover:border-primary/50 hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {isLoggedIn ? (
                      <ArrowUp className={cn('size-4', mine && 'animate-bounce')} />
                    ) : (
                      <LogIn className="size-4" />
                    )}
                    {mine ? 'Mon vote' : isLoggedIn ? 'Voter pour cette idée' : 'Entrer pour voter'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {round.hackathonId && (
        <p className="mt-5 inline-flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-sm text-success">
          <Rocket className="size-4" /> Ce tour a donné naissance à un hackathon.
          <Link to="/hackathons" className="underline">
            Le voir
          </Link>
        </p>
      )}
    </section>
  );
}
