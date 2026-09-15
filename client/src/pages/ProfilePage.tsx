import type { HackathonStatus, MyResult } from '@hackametz/shared';
import { ArrowRight, Award, FileBadge, FolderArchive, Heart, LogOut, Medal } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { AchievementBadge } from '@/components/profile/AchievementBadge';
import { Avatar } from '@/components/session/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/useMe';
import { useSession } from '@/hooks/useSession';
import { formatDate, fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const { user, isLoggedIn, logout } = useSession();
  const { data: me } = useMe();
  if (!isLoggedIn || !user) return <Navigate to="/" replace />;

  const podiums = me?.results.filter((r) => r.rank <= 3).length ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card p-6 shadow-soft sm:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(45% 80% at 100% 0%, var(--glow-1), transparent 70%), radial-gradient(35% 60% at 0% 100%, var(--glow-2), transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar user={user} className="size-20 text-2xl ring-4 ring-background" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold tracking-tight">{user.pseudo}</h1>
            <p className="text-sm text-muted-foreground">
              Membre depuis le {formatDate(user.createdAt)} · dernière visite{' '}
              {fromNow(user.lastSeenAt)}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat value={me?.registrations.length ?? 0} label="éditions" />
            <Stat value={me?.submissions.length ?? 0} label="projets" />
            <Stat value={podiums} label="podiums" />
          </dl>
        </div>
      </header>

      {me && me.achievements.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Award className="size-4 text-brand-3" /> Palmarès
            <span className="font-mono text-xs text-muted-foreground">
              {me.achievements.length}
            </span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {me.achievements.map((a) => (
              <li key={`${a.id}-${a.hackathon?.id ?? 'global'}`}>
                <AchievementBadge achievement={a} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {me && me.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="size-4" /> Mes résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {me.results.map((r) => (
                <ResultRow key={r.submissionId} result={r} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mes hackathons</CardTitle>
        </CardHeader>
        <CardContent>
          {me && me.registrations.length > 0 ? (
            <ul className="divide-y">
              {me.registrations.map(({ hackathon: h, joinedAt, team }) => {
                const project = me.submissions.find((s) => s.hackathon.id === h.id);
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span
                      className="h-8 w-1.5 rounded-full"
                      style={{ background: h.coverColor }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/hackathons/${h.slug}`} className="font-medium hover:text-primary">
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          #{h.code}
                        </span>
                        {h.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        inscrit {fromNow(joinedAt)}
                        {team && ` · équipe ${team.name} (${team.memberPseudos.join(', ')})`}
                        {project
                          ? ` · projet « ${project.title} » (v${project.version})`
                          : ' · aucun projet déposé'}
                      </p>
                    </div>
                    <StatusBadge status={h.status as HackathonStatus} />
                    {project ? (
                      <Link
                        to={`/hackathons/${h.slug}/projects/${project.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Voir <ArrowRight className="size-3.5" />
                      </Link>
                    ) : h.status === 'running' ? (
                      <Link
                        to={`/hackathons/${h.slug}/submit`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Déposer <ArrowRight className="size-3.5" />
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu n’es inscrit à aucun hackathon.{' '}
              <Link to="/hackathons" className="text-primary hover:underline">
                Voir les hackathons
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderArchive className="size-4" /> Mes projets archivés
          </CardTitle>
        </CardHeader>
        <CardContent>
          {me && me.submissions.length > 0 ? (
            <ul className="divide-y text-sm">
              {me.submissions.map((s) => (
                <li key={s.id} className="py-2.5">
                  <Link
                    to={`/hackathons/${s.hackathon.slug}/projects/${s.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {s.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {s.hackathon.title} · v{s.version} · {fromNow(s.submittedAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun projet déposé pour l’instant.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cet appareil</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Ton pseudo est lié à cet appareil. Si tu changes d’appareil, demande à l’organisateur de
            libérer ton pseudo.
          </p>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              logout();
              toast('Déconnecté de cet appareil');
            }}
          >
            <LogOut /> Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-background/70 px-3 py-2">
      <dd className="font-display text-xl font-bold leading-none">{value}</dd>
      <dt className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    </div>
  );
}

const RANK_STYLE: Record<number, string> = {
  1: 'bg-gradient-to-br from-amber-300 to-yellow-600 text-white',
  2: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
  3: 'bg-gradient-to-br from-orange-300 to-amber-700 text-white',
};

function ResultRow({ result: r }: { result: MyResult }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold',
          RANK_STYLE[r.rank] ?? 'bg-muted text-muted-foreground',
        )}
      >
        {r.rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {r.title}
          {r.publicFavorite && (
            <Heart
              className="ml-1.5 inline size-3.5 fill-current text-brand-2"
              aria-label="Coup de cœur du public"
            />
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          #{r.hackathon.code} {r.hackathon.title} · {r.rank}
          {r.rank === 1 ? 'ᵉʳ' : 'ᵉ'} sur {r.total}
          {r.score !== null && ` · ${r.score}/100`}
          {r.prize && ` · ${r.prize}`}
        </p>
      </div>
      <Link
        to={`/me/certificat/${r.hackathon.slug}`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <FileBadge className="size-3.5" /> Certificat
      </Link>
    </li>
  );
}
