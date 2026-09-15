import type { Hackathon } from '@hackametz/shared';
import { useServerNow } from '@/hooks/useServerTime';
import { formatShort } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Step {
  label: string;
  at: string;
}

/** Frise de l'édition : inscriptions → début → deadline → fin, avec la position actuelle. */
export function Timeline({
  hackathon: h,
  className,
}: {
  hackathon: Hackathon;
  className?: string;
}) {
  const now = useServerNow()();
  const steps: Step[] = [
    ...(h.dates.registrationOpensAt
      ? [{ label: 'Inscriptions', at: h.dates.registrationOpensAt }]
      : []),
    { label: 'Début', at: h.dates.startsAt },
    { label: 'Deadline', at: h.dates.submissionDeadlineAt },
    { label: 'Fin', at: h.dates.endsAt },
    ...(h.dates.resultsAt ? [{ label: 'Résultats', at: h.dates.resultsAt }] : []),
  ];
  const first = new Date(steps[0]!.at).getTime();
  const last = new Date(steps[steps.length - 1]!.at).getTime();
  const progress =
    last > first ? Math.min(100, Math.max(0, ((now - first) / (last - first)) * 100)) : 0;

  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-0 right-0 top-[7px] h-1 rounded-full bg-muted" aria-hidden />
      <div
        className="absolute left-0 top-[7px] h-1 rounded-full bg-brand transition-[width] duration-700"
        style={{ width: `${progress}%` }}
        aria-hidden
      />
      <ol className="relative flex justify-between">
        {steps.map((step, i) => {
          const done = new Date(step.at).getTime() <= now;
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;
          return (
            <li
              key={step.label}
              className={cn(
                'flex w-24 flex-col text-xs',
                isFirst
                  ? 'items-start text-left'
                  : isLast
                    ? 'items-end text-right'
                    : 'items-center text-center',
              )}
            >
              <span
                className={cn(
                  'size-[15px] rounded-full border-2 border-card',
                  done
                    ? 'bg-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand-2)_25%,transparent)]'
                    : 'bg-muted-foreground/40',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'mt-2 font-medium',
                  done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="text-[11px] text-muted-foreground">{formatShort(step.at)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
