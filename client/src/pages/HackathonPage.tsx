import { useState } from 'react';
import type { HackathonWithCounts } from '@hackametz/shared';
import { HACKATHON_FORMAT_LABELS } from '@hackametz/shared';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  CopyPlus,
  ExternalLink,
  FileArchive,
  FolderArchive,
  Heart,
  LogIn,
  LogOut,
  MapPin,
  MonitorPlay,
  MoreHorizontal,
  Pencil,
  QrCode,
  Scale,
  Trophy,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link, useOutletContext, useParams } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import type { ShellContext } from '@/components/layout/AppShell';
import { AnnouncementsPanel } from '@/components/hackathon/AnnouncementsPanel';
import { Countdown } from '@/components/hackathon/Countdown';
import { FeedbackPanel } from '@/components/hackathon/FeedbackPanel';
import { JoinDialog } from '@/components/hackathon/JoinDialog';
import { ParticipationChecklist } from '@/components/hackathon/ParticipationChecklist';
import { QrDialog } from '@/components/hackathon/QrDialog';
import { QuestionsPanel } from '@/components/hackathon/QuestionsPanel';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { SubmissionCard } from '@/components/hackathon/SubmissionCard';
import { TeamPanel } from '@/components/hackathon/TeamPanel';
import { Timeline } from '@/components/hackathon/Timeline';
import { Markdown } from '@/components/markdown/Markdown';
import { Avatar } from '@/components/session/Avatar';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Menu, MenuItem, MenuLabel, MenuLink, MenuSeparator } from '@/components/ui/menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useIsJuror } from '@/hooks/useEvaluations';
import { useHackathonEvents } from '@/hooks/useHackathonEvents';
import { useHackathon } from '@/hooks/useHackathons';
import { useMe } from '@/hooks/useMe';
import { useQuestions } from '@/hooks/useQuestions';
import { useLeaveHackathon, useParticipants, useSubmissions } from '@/hooks/useParticipation';
import { useSession } from '@/hooks/useSession';
import { formatDateTime, formatRange, fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { NotFoundPage } from './NotFoundPage';

type Tab = 'about' | 'participants' | 'announcements' | 'questions' | 'projects';

export function HackathonPage() {
  const { slug = '' } = useParams();
  const { openPseudoDialog } = useOutletContext<ShellContext>();
  const { isLoggedIn, isAdmin } = useSession();
  const { data: h, isPending, isError, error } = useHackathon(slug);
  const { data: me } = useMe();
  const { data: participants } = useParticipants(slug);
  const { data: submissions } = useSubmissions(slug);
  const { data: announcements } = useAnnouncements(slug);
  const { data: questions } = useQuestions(slug);
  const leave = useLeaveHackathon(slug);
  const isJuror = useIsJuror(slug);
  const [tab, setTab] = useState<Tab>('about');
  const [joinOpen, setJoinOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  useHackathonEvents(slug);

  if (isPending)
    return (
      <div className="h-80 animate-pulse rounded-[28px] border bg-muted/60" aria-busy="true" />
    );
  if (isError) {
    if (error instanceof ApiError && error.status === 404)
      return <NotFoundPage what="Ce hackathon" />;
    return <p className="text-destructive">{error.message}</p>;
  }

  const isRunning = h.status === 'running';
  const isUpcoming = h.status === 'published';
  const canJoin = isUpcoming || isRunning;
  const registered = me?.registrations.some((r) => r.hackathon.id === h.id) ?? false;
  const mySubmission = me?.submissions.find((s) => s.hackathon.id === h.id);
  const canSubmit =
    registered && (isRunning || (h.submission.allowLate && h.status === 'submissions_closed'));
  const resultsVisible = h.status === 'finished' || h.status === 'archived' || isAdmin;
  const canGrade = isJuror && ['running', 'submissions_closed', 'judging'].includes(h.status);
  const countdownTarget = isRunning
    ? { iso: h.dates.submissionDeadlineAt, label: 'Deadline de dépôt' }
    : isUpcoming
      ? { iso: h.dates.startsAt, label: 'Début dans' }
      : null;

  async function handleLeave() {
    try {
      await leave.mutateAsync();
      toast('Tu ne participes plus à ce hackathon');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Impossible de quitter le hackathon');
    }
  }

  const primaryAction =
    !isLoggedIn && canJoin ? (
      <Button size="lg" onClick={openPseudoDialog}>
        <LogIn /> Entrer pour participer
      </Button>
    ) : isLoggedIn && !registered && canJoin ? (
      <Button size="lg" onClick={() => setJoinOpen(true)}>
        <UserPlus /> Rejoindre l’édition
      </Button>
    ) : registered && canSubmit ? (
      <Link to={`/hackathons/${h.slug}/submit`} className={buttonVariants({ size: 'lg' })}>
        <Upload /> {mySubmission ? 'Mettre à jour mon projet' : 'Déposer mon projet'}
      </Link>
    ) : resultsVisible && h.counts.submissions > 0 ? (
      <Link to={`/hackathons/${h.slug}/results`} className={buttonVariants({ size: 'lg' })}>
        <Trophy /> Voir les résultats
      </Link>
    ) : null;

  return (
    <article className="flex flex-col gap-6">
      <Link
        to="/hackathons"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Tous les hackathons
      </Link>

      {/* ------------------------------------------------------------ En-tête */}
      <header className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-soft">
        <div
          className="relative h-36 sm:h-44"
          style={{
            background: `linear-gradient(120deg, ${h.coverColor} 0%, color-mix(in oklab, ${h.coverColor} 55%, #0b1020) 100%)`,
          }}
        >
          <div className="grid-fade absolute inset-0" aria-hidden />
          <span
            className="absolute -bottom-6 right-6 select-none font-display text-[96px] font-bold leading-none text-white/10 sm:text-[128px]"
            aria-hidden
          >
            {h.code}
          </span>
          <div className="absolute left-6 top-5 flex flex-wrap items-center gap-2 sm:left-8">
            <StatusBadge status={h.status} className="bg-white/90 text-[#141a2a] shadow-soft" />
            <span className="inline-flex items-center gap-1 rounded-md bg-black/25 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
              <MapPin className="size-3" /> {HACKATHON_FORMAT_LABELS[h.format]}
              {h.location && ` · ${h.location}`}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-black/25 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
              <CalendarDays className="size-3" /> {formatRange(h.dates.startsAt, h.dates.endsAt)}
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{h.title}</h1>
            <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{h.theme}</p>
            {h.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {h.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                <dd className="font-medium text-foreground">{h.counts.participants}</dd>
                <dt>inscrits</dt>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <FolderArchive className="size-4" />
                <dd className="font-medium text-foreground">{h.counts.submissions}</dd>
                <dt>projets</dt>
              </div>
              <div className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                <dd className="font-medium text-foreground">
                  {h.team.enabled ? `${h.team.minSize}–${h.team.maxSize}` : 'solo'}
                </dd>
                <dt>{h.team.enabled ? 'par équipe' : ''}</dt>
              </div>
            </dl>
          </div>

          <div className="flex w-full flex-col gap-3 lg:w-72">
            {countdownTarget && (
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <Countdown targetIso={countdownTarget.iso} label={countdownTarget.label} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-1 [&>*]:w-full">{primaryAction}</div>
              <Menu
                trigger={({ open, toggle }) => (
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0"
                    aria-label="Autres actions"
                    aria-expanded={open}
                    onClick={toggle}
                  >
                    <MoreHorizontal />
                  </Button>
                )}
              >
                <MenuLabel>Édition #{h.code}</MenuLabel>
                {resultsVisible && (
                  <MenuLink to={`/hackathons/${h.slug}/results`}>
                    <Trophy /> Résultats
                  </MenuLink>
                )}
                {canGrade && (
                  <MenuLink to={`/jury/${h.slug}`}>
                    <ClipboardList /> Noter les projets
                  </MenuLink>
                )}
                {registered && mySubmission && (
                  <MenuLink to={`/hackathons/${h.slug}/projects/${mySubmission.id}`}>
                    <FileArchive /> Mon projet
                  </MenuLink>
                )}
                {registered && !mySubmission && canJoin && (
                  <MenuItem onClick={handleLeave} disabled={leave.isPending}>
                    <LogOut /> Quitter l’édition
                  </MenuItem>
                )}
                {isAdmin && (
                  <>
                    <MenuSeparator />
                    <MenuLabel>Organisateur</MenuLabel>
                    <MenuItem onClick={() => setQrOpen(true)}>
                      <QrCode /> QR code à projeter
                    </MenuItem>
                    <MenuItem onClick={() => window.open(`/hackathons/${h.slug}/ecran`, '_blank')}>
                      <MonitorPlay /> Mode écran (vidéoprojecteur)
                    </MenuItem>
                    <MenuLink to={`/admin/hackathons/${h.slug}/edit`}>
                      <Pencil /> Modifier l’édition
                    </MenuLink>
                    <MenuLink to={`/admin/hackathons/new?from=${h.slug}`}>
                      <CopyPlus /> Dupliquer pour une nouvelle édition
                    </MenuLink>
                  </>
                )}
              </Menu>
            </div>
            {registered && (
              <p className="inline-flex items-center gap-1.5 text-sm text-success">
                <Check className="size-4" /> Tu participes à cette édition
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border/60 px-6 py-5 sm:px-8">
          <Timeline hackathon={h} />
        </div>
      </header>

      {/* ------------------------------------------------------------ Onglets */}
      <div className="glass sticky top-14 z-20 -mx-1 rounded-xl border border-border/60 px-2 lg:top-3">
        <Tabs
          value={tab}
          onChange={setTab}
          className="border-b-0"
          tabs={[
            { value: 'about', label: 'Présentation' },
            {
              value: 'participants',
              label: h.team.enabled ? 'Participants & équipes' : 'Participants',
              count: participants?.length ?? h.counts.participants,
            },
            { value: 'announcements', label: 'Annonces', count: announcements?.length ?? 0 },
            {
              value: 'questions',
              label: 'Questions',
              count: questions?.filter((q) => !q.answer).length ?? 0,
            },
            {
              value: 'projects',
              label: 'Projets',
              count: submissions?.length ?? h.counts.submissions,
            },
          ]}
        />
      </div>

      {tab === 'about' && (
        <AboutTab
          h={h}
          registered={registered}
          onEnter={openPseudoDialog}
          onJoin={() => (isLoggedIn ? setJoinOpen(true) : openPseudoDialog())}
        />
      )}

      {tab === 'participants' && (
        <section className="flex flex-col gap-8">
          {h.team.enabled && <TeamPanel hackathon={h} registered={registered} />}
          {participants && participants.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-soft"
                >
                  <Avatar user={p} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.pseudo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.teamName ? `équipe ${p.teamName}` : `inscrit ${fromNow(p.joinedAt)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Users}
              title="Personne n’est encore inscrit"
              description="Sois le premier à rejoindre cette édition."
            />
          )}
        </section>
      )}

      {tab === 'announcements' && <AnnouncementsPanel slug={h.slug} />}

      {tab === 'questions' && (
        <QuestionsPanel slug={h.slug} closed={h.status === 'archived'} onEnter={openPseudoDialog} />
      )}

      {tab === 'projects' && (
        <section>
          {submissions && submissions.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {submissions.map((s) => (
                <SubmissionCard key={s.id} submission={s} hackathonSlug={h.slug} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileArchive}
              title="Aucun projet déposé"
              description={
                isRunning
                  ? 'Les dépôts sont ouverts jusqu’à la deadline — glisse ton dossier ou ton zip.'
                  : 'Cette édition n’a pas reçu de projet.'
              }
            />
          )}
          {(h.publicVote ?? false) && submissions && submissions.length > 0 && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Heart className="size-4 text-brand-2" /> Le cœur sur chaque carte est le coup de cœur
              du public : un vote par participant, hors son propre projet.
            </p>
          )}
        </section>
      )}

      <JoinDialog hackathon={h} open={joinOpen} onClose={() => setJoinOpen(false)} />
      <QrDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        path={`/hackathons/${h.slug}`}
        title={`« ${h.title} »`}
      />
    </article>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: typeof Users;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn('rounded-2xl border border-border/70 bg-card p-6 shadow-soft', className)}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {Icon && <Icon className="size-4 text-muted-foreground" />} {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AboutTab({
  h,
  registered,
  onEnter,
  onJoin,
}: {
  h: HackathonWithCounts;
  registered: boolean;
  onEnter: () => void;
  onJoin: () => void;
}) {
  // Le parcours ne s'affiche que tant qu'il reste quelque chose à faire.
  const participationOpen = ['published', 'running', 'submissions_closed', 'judging'].includes(
    h.status,
  );
  const feedbackPhase = ['submissions_closed', 'judging', 'finished', 'archived'].includes(
    h.status,
  );
  const totalWeight = h.criteria.reduce((sum, c) => sum + c.weight, 0) || 1;
  const facts: { label: string; value: string }[] = [
    { label: 'Format', value: HACKATHON_FORMAT_LABELS[h.format] },
    { label: 'Lieu', value: h.location || '—' },
    {
      label: 'Équipes',
      value: h.team.enabled ? `${h.team.minSize} à ${h.team.maxSize} personnes` : 'Solo',
    },
    {
      label: 'Participants max',
      value: h.maxParticipants ? String(h.maxParticipants) : 'Illimité',
    },
    {
      label: 'Dépôt',
      value: `${h.submission.formats.join(' / ')} · ${h.submission.maxSizeMb} Mo`,
    },
    {
      label: 'Re-dépôt',
      value: h.submission.allowResubmit ? 'Jusqu’à la deadline' : 'Une seule fois',
    },
    { label: 'Licence', value: h.submission.license },
    { label: 'Fuseau', value: h.timezone },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-6">
        {h.description ? (
          <Panel title="Présentation">
            <Markdown>{h.description}</Markdown>
          </Panel>
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="Présentation à venir"
            description="L’organisateur n’a pas encore rédigé le descriptif de cette édition."
            compact
          />
        )}
        {h.rules && (
          <Panel title="Règlement" icon={Scale}>
            <Markdown>{h.rules}</Markdown>
          </Panel>
        )}
        {h.criteria.length > 0 && (
          <Panel title="Critères d’évaluation" icon={ClipboardList}>
            <ul className="flex flex-col gap-4">
              {h.criteria.map((c) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <p className="font-medium">{c.label}</p>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {Math.round((c.weight / totalWeight) * 100)} % · /{c.maxScore}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(c.weight / totalWeight) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel title="Calendrier" icon={CalendarDays}>
          <ol className="relative flex flex-col gap-4 border-l border-border/70 pl-5">
            {[
              h.dates.registrationOpensAt
                ? { label: 'Ouverture des inscriptions', at: h.dates.registrationOpensAt }
                : null,
              { label: 'Début', at: h.dates.startsAt },
              ...h.milestones.map((m) => ({ label: m.label, at: m.at, milestone: true })),
              { label: 'Deadline de dépôt', at: h.dates.submissionDeadlineAt, strong: true },
              { label: 'Fin', at: h.dates.endsAt },
              h.dates.resultsAt ? { label: 'Résultats', at: h.dates.resultsAt } : null,
            ]
              .filter((x): x is NonNullable<typeof x> => x !== null)
              .sort((a, b) => a.at.localeCompare(b.at))
              .map((item) => (
                <li key={item.label + item.at} className="relative text-sm">
                  <span
                    className={cn(
                      'absolute -left-[26px] top-1.5 size-2.5 rounded-full',
                      'strong' in item && item.strong ? 'bg-brand' : 'bg-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                  <p className={cn('font-medium', 'milestone' in item && 'text-muted-foreground')}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                </li>
              ))}
          </ol>
        </Panel>
      </div>

      <aside className="flex flex-col gap-6">
        {participationOpen && (
          <ParticipationChecklist hackathon={h} onEnter={onEnter} onJoin={onJoin} />
        )}
        {feedbackPhase && <FeedbackPanel slug={h.slug} registered={registered} />}
        <Panel title="Infos clés">
          <dl className="grid grid-cols-2 gap-3">
            {facts.map((f) => (
              <div key={f.label} className="rounded-xl bg-muted/50 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </dt>
                <dd className="mt-0.5 truncate text-sm font-medium" title={f.value}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        {h.prizes.length > 0 && (
          <Panel title="Prix" icon={Trophy}>
            <ol className="flex flex-col gap-3">
              {h.prizes.map((p) => (
                <li key={p.rank} className="flex gap-3">
                  <span
                    className={cn(
                      'inline-flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold',
                      p.rank === 1 ? 'bg-brand text-white' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {p.rank}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {h.resources.length > 0 && (
          <Panel title="Ressources">
            <ul className="flex flex-col gap-2 text-sm">
              {h.resources.map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {r.label} <ExternalLink className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <FolderArchive className="size-4 shrink-0" /> {h.storagePath}
        </p>
      </aside>
    </div>
  );
}
