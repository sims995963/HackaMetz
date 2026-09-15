import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Bouton ou lien d'action principal. */
  action?: React.ReactNode;
  className?: string;
  /** Version resserrée pour un panneau latéral. */
  compact?: boolean;
}

/**
 * État vide : une icône posée dans un halo de marque, un titre, une explication
 * et — quand c'est possible — l'action qui remplit l'écran.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: Props) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-border bg-card/40 text-center',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-70"
        style={{
          background: 'radial-gradient(55% 90% at 50% 0%, var(--glow-1), transparent 70%)',
        }}
        aria-hidden
      />
      <span
        className={cn(
          'relative inline-flex items-center justify-center rounded-2xl border border-border/70 bg-card shadow-soft',
          compact ? 'size-11' : 'size-14',
        )}
        aria-hidden
      >
        <Icon className={cn('text-muted-foreground', compact ? 'size-5' : 'size-6')} />
      </span>
      <p className={cn('relative mt-4 font-semibold', compact ? 'text-sm' : 'text-base')}>
        {title}
      </p>
      {description && (
        <p className="relative mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}
