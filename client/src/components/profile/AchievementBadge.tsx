import type { Achievement, AchievementId } from '@hackametz/shared';
import {
  Footprints,
  Gavel,
  Hammer,
  Heart,
  Medal,
  MessageCircleQuestion,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const STYLE: Record<AchievementId, { icon: typeof Trophy; className: string }> = {
  first_steps: { icon: Footprints, className: 'from-sky-400 to-blue-600' },
  builder: { icon: Hammer, className: 'from-indigo-400 to-violet-600' },
  team_player: { icon: Users, className: 'from-teal-400 to-emerald-600' },
  podium_1: { icon: Trophy, className: 'from-amber-300 to-yellow-600' },
  podium_2: { icon: Medal, className: 'from-slate-300 to-slate-500' },
  podium_3: { icon: Medal, className: 'from-orange-300 to-amber-700' },
  crowd_favorite: { icon: Heart, className: 'from-pink-400 to-rose-600' },
  juror: { icon: Gavel, className: 'from-violet-400 to-fuchsia-600' },
  veteran: { icon: Sparkles, className: 'from-cyan-400 to-blue-600' },
  curious: { icon: MessageCircleQuestion, className: 'from-lime-400 to-green-600' },
};

/** Pastille de succès : disque dégradé + icône, avec libellé et contexte. */
export function AchievementBadge({
  achievement: a,
  compact = false,
}: {
  achievement: Achievement;
  compact?: boolean;
}) {
  const { icon: Icon, className } = STYLE[a.id];
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border/70 bg-card shadow-soft',
        compact ? 'p-2.5' : 'p-3.5',
      )}
      title={a.description}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lift ring-4 ring-background',
          compact ? 'size-9' : 'size-12',
          className,
        )}
        aria-hidden
      >
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </span>
      <div className="min-w-0">
        <p className={cn('truncate font-semibold', compact ? 'text-sm' : 'text-[15px]')}>
          {a.label}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {a.hackathon ? `#${a.hackathon.code} ${a.hackathon.title}` : a.description}
          {!compact && ` · ${formatDate(a.earnedAt)}`}
        </p>
      </div>
    </div>
  );
}
