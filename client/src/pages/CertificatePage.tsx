import { ArrowLeft, Heart, Printer } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';
import { Brand } from '@/components/layout/Brand';
import { Button, buttonVariants } from '@/components/ui/button';
import { useHackathon } from '@/hooks/useHackathons';
import { useMe } from '@/hooks/useMe';
import { useSession } from '@/hooks/useSession';
import { formatDate, formatRange } from '@/lib/dates';
import { NotFoundPage } from './NotFoundPage';

const ORDINAL = (rank: number) => (rank === 1 ? '1ʳᵉ' : `${rank}ᵉ`);

/** Certificat imprimable (Ctrl+P → PDF) : participation, et classement si l'édition est terminée. */
export function CertificatePage() {
  const { slug = '' } = useParams();
  const { user, isLoggedIn } = useSession();
  const { data: me } = useMe();
  const { data: h, isPending, isError } = useHackathon(slug);
  if (!isLoggedIn || !user) return <Navigate to="/" replace />;
  if (isPending || !me) {
    return (
      <div className="h-96 animate-pulse rounded-[28px] border bg-muted/60" aria-busy="true" />
    );
  }
  if (isError) return <NotFoundPage what="Ce hackathon" />;

  const registration = me.registrations.find((r) => r.hackathon.id === h.id);
  if (!registration) return <NotFoundPage what="Ce certificat" />;
  const result = me.results.find((r) => r.hackathon.id === h.id);
  const project = me.submissions.find((s) => s.hackathon.id === h.id);
  const finished = h.status === 'finished' || h.status === 'archived';
  const badges = me.achievements.filter((a) => a.hackathon?.id === h.id);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/me" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft /> Mon profil
        </Link>
        <Button onClick={() => window.print()}>
          <Printer /> Imprimer / PDF
        </Button>
      </div>

      <article
        className="relative overflow-hidden rounded-[28px] bg-brand p-[3px] shadow-pop print:rounded-none print:p-0 print:shadow-none"
        aria-label="Certificat"
      >
        <div className="relative rounded-[25px] bg-card px-8 py-10 sm:px-14 sm:py-14 print:rounded-none print:border-8 print:border-[#2f6bff]">
          <div
            className="pointer-events-none absolute inset-0 opacity-50 print:hidden"
            style={{
              background:
                'radial-gradient(40% 60% at 100% 0%, var(--glow-2), transparent 70%), radial-gradient(35% 50% at 0% 100%, var(--glow-3), transparent 70%)',
            }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -right-6 -top-8 select-none font-mono text-[9rem] font-bold leading-none text-foreground/[0.04]"
            aria-hidden
          >
            #{h.code}
          </span>

          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <Brand />
              <p className="text-right font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Édition #{h.code}
              </p>
            </div>

            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-brand">
              {finished && result ? 'Certificat de résultat' : 'Certificat de participation'}
            </p>
            <p className="mt-3 text-muted-foreground">Ce document atteste que</p>
            <h1 className="font-display mt-1 text-5xl font-bold tracking-tight sm:text-6xl">
              {user.pseudo}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/85">
              a participé au hackathon <strong className="font-semibold">{h.title}</strong>
              {h.theme && (
                <>
                  {' '}
                  — <em>{h.theme}</em>
                </>
              )}
              , {formatRange(h.dates.startsAt, h.dates.endsAt)}
              {h.location && ` à ${h.location}`}
              {project && (
                <>
                  , avec le projet <strong className="font-semibold">« {project.title} »</strong>
                </>
              )}
              {registration.team && (
                <>
                  {' '}
                  au sein de l’équipe{' '}
                  <strong className="font-semibold">{registration.team.name}</strong> (
                  {registration.team.memberPseudos.join(', ')})
                </>
              )}
              .
            </p>

            {finished && result && (
              <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-background/70 px-5 py-4 print:bg-white">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-brand font-display text-2xl font-bold text-white">
                  {result.rank}
                </span>
                <div>
                  <p className="text-lg font-semibold">
                    {ORDINAL(result.rank)} place sur {result.total}
                    {result.prize && ` · ${result.prize}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.score !== null && `Score du jury : ${result.score}/100`}
                    {result.publicFavorite && (
                      <span className="ml-2 inline-flex items-center gap-1 text-brand-2">
                        <Heart className="size-3.5 fill-current" /> Coup de cœur du public
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {badges.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-medium print:bg-white"
                  >
                    {b.label}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-12 flex flex-wrap items-end justify-between gap-6 border-t border-border/60 pt-6 text-sm text-muted-foreground">
              <div>
                <p>Délivré le {formatDate(new Date().toISOString())}</p>
                <p className="font-mono text-[11px]">
                  hackametz · {h.slug} · {user.pseudo}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-bold text-foreground">HackaMetz</p>
                <p>L’organisateur</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      {!finished && (
        <p className="text-center text-xs text-muted-foreground print:hidden">
          L’édition n’est pas terminée : le classement apparaîtra sur le certificat à la publication
          des résultats.
        </p>
      )}
    </div>
  );
}
