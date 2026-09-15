import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { useSession } from '@/hooks/useSession';
import { useCastVote, useVotes } from '@/hooks/useVotes';
import { cn } from '@/lib/utils';

interface Props {
  slug: string;
  submissionId: string;
  /** Compact : icône + compteur, pour une carte. */
  compact?: boolean;
  className?: string;
}

/** Cœur « coup de cœur du public » : un vote par participant, cliquable tant que le vote est ouvert. */
export function VoteButton({ slug, submissionId, compact, className }: Props) {
  const { isLoggedIn } = useSession();
  const { data } = useVotes(slug);
  const cast = useCastVote(slug);
  if (!data) return null;

  const count = data.counts[submissionId] ?? 0;
  const mine = data.mine === submissionId;
  const disabled = !data.open || !isLoggedIn || cast.isPending;

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) {
      toast('Entre avec ton pseudo pour voter');
      return;
    }
    try {
      await cast.mutateAsync(mine ? null : submissionId);
      toast.success(mine ? 'Vote retiré' : 'Coup de cœur enregistré !');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Vote impossible');
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled && !mine}
      aria-pressed={mine}
      title={data.open ? (mine ? 'Retirer mon vote' : 'Voter pour ce projet') : 'Vote fermé'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border text-sm transition-all',
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5',
        mine
          ? 'border-transparent bg-brand text-white shadow-soft'
          : 'border-border/70 bg-card text-muted-foreground hover:border-brand-2/50 hover:text-brand-2',
        disabled && !mine && 'cursor-default opacity-70',
        className,
      )}
    >
      <Heart className={cn('size-3.5', mine && 'fill-current')} />
      <span className="font-mono tabular-nums">{count}</span>
      {!compact && <span>{count > 1 ? 'coups de cœur' : 'coup de cœur'}</span>}
    </button>
  );
}
