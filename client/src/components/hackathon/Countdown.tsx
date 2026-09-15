import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

interface Props {
  targetIso: string;
  label: string;
  /** Compact : "2 j 05 h 12 min" sur une ligne. */
  compact?: boolean;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function Countdown({ targetIso, label, compact, className }: Props) {
  const c = useCountdown(targetIso);
  if (!c) return null;

  if (compact) {
    return (
      <span className={cn('font-mono text-sm tabular-nums text-muted-foreground', className)}>
        {c.isOver
          ? 'Terminé'
          : `${label} ${c.days > 0 ? `${c.days} j ` : ''}${pad(c.hours)} h ${pad(c.minutes)} min`}
      </span>
    );
  }

  if (c.isOver) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{label} : terminé</p>;
  }

  const cells: [number, string][] = [
    [c.days, 'jours'],
    [c.hours, 'heures'],
    [c.minutes, 'min'],
    [c.seconds, 'sec'],
  ];
  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 flex gap-3">
        {cells.map(([value, unit]) => (
          <div key={unit} className="min-w-14 rounded-lg border bg-card px-2 py-1.5 text-center">
            <div className="font-mono text-2xl font-semibold tabular-nums leading-none">
              {pad(value)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {unit}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
