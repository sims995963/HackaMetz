import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { usePublicStats } from '@/hooks/useStats';

/** Page de marque, purement esthétique : le nom en très grand sur le fond « mesh » animé. */
export function BrandPage() {
  const { data: stats } = usePublicStats();

  return (
    <div className="hero-mesh relative -mx-4 -my-8 flex min-h-[calc(100svh-3.5rem)] flex-col overflow-hidden text-white sm:-mx-6 lg:-mx-10 lg:-my-10 lg:min-h-svh">
      <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
      <div className="orb -left-32 -top-32 size-[28rem] bg-brand-1" aria-hidden />
      <div
        className="orb -right-24 top-1/4 size-[26rem] bg-brand-2 [animation-delay:-5s]"
        aria-hidden
      />
      <div
        className="orb -bottom-40 left-1/3 size-[30rem] bg-brand-3 [animation-delay:-9s]"
        aria-hidden
      />

      <Link
        to="/"
        className="relative z-10 m-6 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
      >
        <ArrowLeft className="size-4" /> Retour
      </Link>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.35em] text-white/50">
          Metz · hackathons · base de connaissance
        </p>
        <h1 className="brand-wordmark font-display font-bold leading-none tracking-tight">
          Hacka<span className="text-brand">Metz</span>
        </h1>
        <p className="mt-8 max-w-md text-lg text-white/65">
          Un pseudo. Un projet. Une base qui grandit.
        </p>
        {stats && (
          <dl className="mt-10 flex gap-10 text-sm text-white/55">
            {[
              [stats.hackathons, 'éditions'],
              [stats.participants, 'participants'],
              [stats.submissions, 'projets'],
            ].map(([value, label]) => (
              <div key={label}>
                <dd className="font-display text-3xl font-bold text-white">{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      <p className="relative z-10 pb-6 text-center font-mono text-[11px] text-white/35">
        storage/hackathons/NNN-…/projects/
      </p>
    </div>
  );
}
