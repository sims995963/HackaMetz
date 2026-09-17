import { usePublicStats } from '@/hooks/useStats';

/**
 * Page de marque, purement esthétique : le nom en très grand, posé sur le fond
 * lumineux de l'application. Aucun décor propre à la page, aucun bouton :
 * la navigation reste dans le rail.
 */
export function BrandPage() {
  const { data: stats } = usePublicStats();

  return (
    <div className="flex min-h-[calc(100svh-10rem)] flex-col items-center justify-center px-6 text-center lg:min-h-[calc(100svh-6rem)]">
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
        Metz · hackathons · base de connaissance
      </p>
      <h1 className="brand-wordmark font-display font-bold leading-none tracking-tight">
        Hacka<span className="text-brand">Metz</span>
      </h1>
      <p className="mt-8 max-w-md text-lg text-muted-foreground">
        Un pseudo. Un projet. Une base qui grandit.
      </p>

      {stats && (
        <dl className="mt-10 flex flex-wrap justify-center gap-10 text-sm text-muted-foreground">
          {[
            [stats.hackathons, 'éditions'],
            [stats.participants, 'participants'],
            [stats.submissions, 'projets'],
          ].map(([value, label]) => (
            <div key={label}>
              <dd className="font-display text-3xl font-bold text-foreground">{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-16 font-mono text-[11px] text-muted-foreground/60">
        storage/hackathons/NNN-…/projects/
      </p>
    </div>
  );
}
