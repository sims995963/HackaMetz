import { useEffect, useRef } from 'react';
import { HACKATHON_STATUS_LABELS } from '@hackametz/shared';
import { Megaphone, Pin, Upload, Users } from 'lucide-react';
import { useParams } from 'react-router';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useCountdown } from '@/hooks/useCountdown';
import { useHackathon } from '@/hooks/useHackathons';
import { useHackathonEvents } from '@/hooks/useHackathonEvents';
import { useParticipants, useSubmissions } from '@/hooks/useParticipation';
import { useTeams } from '@/hooks/useTeams';
import { formatDateTime, fromNow } from '@/lib/dates';
import { NotFoundPage } from './NotFoundPage';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Page à projeter pendant l'événement : compte à rebours géant, dernières annonces,
 * mur des dépôts en direct. Aucune navigation, rien à cliquer, elle se met à jour toute seule.
 */
export function ScreenPage() {
  const { slug = '' } = useParams();
  const { data: h, isPending, isError } = useHackathon(slug);
  const { data: announcements } = useAnnouncements(slug);
  const { data: submissions } = useSubmissions(slug);
  const { data: participants } = useParticipants(slug);
  const { data: teams } = useTeams(slug);
  useHackathonEvents(slug);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const running = h?.status === 'running';
  const target = h
    ? running
      ? { iso: h.dates.submissionDeadlineAt, label: 'Dépôt jusqu’à' }
      : { iso: h.dates.startsAt, label: 'Départ dans' }
    : null;
  const countdown = useCountdown(target?.iso ?? new Date().toISOString());

  // QR code vers la page du hackathon : les retardataires scannent l'écran.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !h) return;
    void import('qrcode').then(({ toCanvas }) =>
      toCanvas(canvas, `${window.location.origin}/hackathons/${h.slug}`, {
        width: 160,
        margin: 1,
        color: { dark: '#0b1020', light: '#ffffff' },
      }),
    );
  }, [h]);

  if (isPending) return <div className="min-h-svh bg-[#0b1020]" aria-busy="true" />;
  if (isError || !h) return <NotFoundPage what="Ce hackathon" />;

  const pinned = (announcements ?? []).slice(0, 3);
  const latest = (submissions ?? [])
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return (
    <div className="hero-mesh relative min-h-svh overflow-hidden px-8 py-8 text-white lg:px-14 lg:py-12">
      <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
      <div className="orb -left-40 -top-40 size-[34rem] bg-brand-1" aria-hidden />
      <div
        className="orb -right-32 top-1/3 size-[30rem] bg-brand-2 [animation-delay:-6s]"
        aria-hidden
      />

      <div className="relative flex min-h-[calc(100svh-6rem)] flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="flex items-center gap-3 font-mono text-sm uppercase tracking-[0.2em] text-white/60">
              #{h.code} · {HACKATHON_STATUS_LABELS[h.status]}
              {running && (
                <span className="inline-flex items-center gap-1.5 text-[color:var(--brand-3)]">
                  <span className="size-2 animate-pulse rounded-full bg-[color:var(--brand-3)]" />
                  en direct
                </span>
              )}
            </p>
            <h1 className="font-display mt-2 text-5xl font-bold leading-[0.95] tracking-tight lg:text-7xl">
              {h.title}
            </h1>
            <p className="mt-3 max-w-3xl text-xl text-white/70 lg:text-2xl">{h.theme}</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur">
            <canvas ref={canvasRef} className="size-[100px] rounded-lg bg-white p-1" />
            <p className="max-w-[9rem] text-sm leading-snug text-white/75">
              Scanne pour rejoindre l’édition
            </p>
          </div>
        </header>

        <section className="grid flex-1 gap-8 lg:grid-cols-[1.25fr_1fr]">
          {/* ------------------------------------------------ compte à rebours */}
          <div className="flex flex-col justify-center rounded-[32px] border border-white/15 bg-black/25 px-8 py-10 backdrop-blur">
            <p className="font-mono text-sm uppercase tracking-[0.2em] text-white/60">
              {target?.label} {target && formatDateTime(target.iso)}
            </p>
            {countdown && !countdown.isOver ? (
              <div className="mt-4 flex flex-wrap items-end gap-6">
                {(
                  [
                    [countdown.days, 'jours'],
                    [countdown.hours, 'heures'],
                    [countdown.minutes, 'minutes'],
                    [countdown.seconds, 'secondes'],
                  ] as [number, string][]
                ).map(([value, unit]) => (
                  <div key={unit}>
                    <div className="font-mono text-7xl font-bold leading-none tabular-nums lg:text-8xl">
                      {pad(value)}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/50">
                      {unit}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-display mt-4 text-6xl font-bold">Temps écoulé</p>
            )}

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-white/75">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-white/50">Inscrits</dt>
                <dd className="font-display text-4xl font-bold text-white">
                  {participants?.length ?? h.counts.participants}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-white/50">Projets</dt>
                <dd className="font-display text-4xl font-bold text-white">
                  {submissions?.length ?? h.counts.submissions}
                </dd>
              </div>
              {h.team.enabled && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.18em] text-white/50">Équipes</dt>
                  <dd className="font-display text-4xl font-bold text-white">
                    {teams?.length ?? 0}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* ------------------------------------------------ annonces + dépôts */}
          <div className="flex min-h-0 flex-col gap-5">
            <div className="rounded-3xl border border-white/15 bg-black/25 p-6 backdrop-blur">
              <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-white/60">
                <Megaphone className="size-4" /> Annonces
              </h2>
              {pinned.length === 0 ? (
                <p className="mt-3 text-white/50">Rien à signaler pour le moment.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {pinned.map((a) => (
                    <li key={a.id} className="border-l-2 border-[color:var(--brand-3)] pl-3">
                      <p className="flex items-center gap-2 text-lg font-semibold leading-snug">
                        {a.pinned && <Pin className="size-4 text-[color:var(--brand-3)]" />}
                        {a.title}
                      </p>
                      <p className="text-sm text-white/55">{fromNow(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/15 bg-black/25 p-6 backdrop-blur">
              <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-white/60">
                <Upload className="size-4" /> Derniers dépôts
              </h2>
              {latest.length === 0 ? (
                <p className="mt-3 text-white/50">Aucun projet déposé pour l’instant.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5 overflow-hidden">
                  {latest.map((s) => (
                    <li key={s.id} className="flex items-baseline gap-3">
                      <span className="font-mono text-sm text-white/45">
                        {String(s.number).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-lg font-medium">{s.title}</span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-white/55">
                        <Users className="size-3.5" /> {s.ownerPseudo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs uppercase tracking-[0.18em] text-white/45">
          <span>HackaMetz</span>
          <span>{h.location || 'en ligne'}</span>
          <span>{window.location.host}</span>
        </footer>
      </div>
    </div>
  );
}
