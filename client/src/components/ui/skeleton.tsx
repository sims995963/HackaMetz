import { cn } from '@/lib/utils';

/**
 * Bloc de chargement avec un reflet qui balaie la surface.
 * On compose des skeletons à la forme du contenu attendu : la page ne « saute » pas à l'arrivée des données.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-lg bg-muted/70',
        'after:absolute after:inset-0 after:animate-shimmer after:bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--card)_65%,transparent),transparent)] after:bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

/** Carte de hackathon en attente : mêmes proportions que la vraie. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft',
        className,
      )}
    >
      <Skeleton className="h-2 rounded-none" />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-9 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Liste de lignes de texte de largeurs décroissantes. */
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: `${100 - i * (40 / Math.max(1, lines))}%` }}
        />
      ))}
    </div>
  );
}
