import { useState } from 'react';
import type { HackathonStatus, HackathonWithCounts } from '@hackametz/shared';
import { HACKATHON_STATUSES, HACKATHON_STATUS_LABELS, STATUS_TRANSITIONS } from '@hackametz/shared';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  CopyPlus,
  Eye,
  MoreHorizontal,
  Undo2,
  FolderArchive,
  GitCommitHorizontal,
  Lock,
  MessageCircleQuestion,
  Pencil,
  Plus,
  QrCode,
  Trophy,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { QrDialog } from '@/components/hackathon/QrDialog';
import { ExportMenu } from '@/components/admin/ExportMenu';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Menu, MenuItem, MenuLabel, MenuLink, MenuSeparator } from '@/components/ui/menu';
import { Table, Td, Th } from '@/components/ui/table';
import { useChangeHackathonStatus, useHackathons } from '@/hooks/useHackathons';
import { useKbExport } from '@/hooks/useKb';
import { useAdminStats } from '@/hooks/useStats';
import { formatShort, fromNow } from '@/lib/dates';
import { useSessionStore } from '@/store/session.store';
import { cn } from '@/lib/utils';

/** Un retour en arrière dans le cycle de vie est affiché plus discrètement. */
function isRollback(from: HackathonStatus, to: HackathonStatus): boolean {
  const order = HACKATHON_STATUSES.indexOf(to) - HACKATHON_STATUSES.indexOf(from);
  return order < 0 || to === 'archived';
}

const TRANSITION_LABELS: Record<HackathonStatus, string> = {
  draft: 'Repasser en brouillon',
  published: 'Publier',
  running: 'Lancer',
  submissions_closed: 'Clore les dépôts',
  judging: 'Ouvrir la délibération',
  finished: 'Terminer',
  archived: 'Archiver',
};

export function AdminDashboardPage() {
  const { data: stats } = useAdminStats(true);
  const { data: hackathons } = useHackathons();
  const changeStatus = useChangeHackathonStatus();
  const setAdminKey = useSessionStore((s) => s.setAdminKey);
  const [qrFor, setQrFor] = useState<HackathonWithCounts | null>(null);
  const kbExport = useKbExport();

  async function exportKb(commit: boolean) {
    try {
      const r = await kbExport.mutateAsync(commit);
      if (r.committed) toast.success(`Commit créé : ${r.commitMessage}`);
      else if (r.gitError) toast(r.gitError);
      else toast.success(`${r.readmes} README et manifests régénérés dans storage/`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Export impossible');
    }
  }

  async function transition(h: HackathonWithCounts, status: HackathonStatus) {
    try {
      await changeStatus.mutateAsync({ slug: h.slug, status });
      toast.success(`${h.title} : ${HACKATHON_STATUS_LABELS[status]}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Changement de statut impossible');
    }
  }

  const tiles = stats
    ? [
        {
          label: 'Hackathons',
          value: stats.hackathons,
          hint: `${stats.running} en cours`,
          icon: Trophy,
        },
        {
          label: 'Pseudos',
          value: stats.users,
          hint: `${stats.participants} ont participé`,
          icon: Users,
        },
        {
          label: 'Inscriptions',
          value: stats.registrations,
          hint: 'toutes éditions',
          icon: Activity,
        },
        {
          label: 'Projets archivés',
          value: stats.submissions,
          hint: 'dans storage/',
          icon: FolderArchive,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand">Espace organisateur</p>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setAdminKey(null)}>
            <Lock /> Verrouiller
          </Button>
          <Link to="/admin/hackathons/new" className={buttonVariants()}>
            <Plus /> Nouveau hackathon
          </Link>
        </div>
      </header>

      {stats && stats.pendingQuestions.length > 0 && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[color:var(--brand-3)]/40 bg-[color:var(--brand-3)]/10 px-5 py-3 text-sm">
          <p className="inline-flex items-center gap-2 font-medium">
            <MessageCircleQuestion className="size-4 text-[color:var(--brand-3)]" /> Questions en
            attente de réponse
          </p>
          {stats.pendingQuestions.map((q) => (
            <Link
              key={q.hackathonSlug}
              to={`/hackathons/${q.hackathonSlug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 shadow-soft hover:text-primary"
            >
              {q.hackathonTitle}
              <span className="rounded-full bg-[color:var(--brand-3)] px-1.5 font-mono text-[11px] font-semibold text-[#141a2a]">
                {q.count}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
        {!stats &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border bg-muted/60" />
          ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Hackathons</h2>
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Hackathon</Th>
              <Th>Statut</Th>
              <Th className="text-right">Inscrits</Th>
              <Th className="text-right">Projets</Th>
              <Th>Deadline</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {(hackathons ?? []).map((h) => (
              <tr key={h.id} className="hover:bg-accent/30">
                <Td className="font-mono text-xs text-muted-foreground">{h.code}</Td>
                <Td>
                  <Link to={`/hackathons/${h.slug}`} className="font-medium hover:text-primary">
                    {h.title}
                  </Link>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">{h.theme}</p>
                </Td>
                <Td>
                  <StatusBadge status={h.status} />
                </Td>
                <Td className="text-right font-mono">{h.counts.participants}</Td>
                <Td className="text-right font-mono">{h.counts.submissions}</Td>
                <Td className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatShort(h.dates.submissionDeadlineAt)}
                </Td>
                <Td className="whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <ExportMenu slug={h.slug} trigger="link" />
                    {STATUS_TRANSITIONS[h.status]
                      .filter((next) => !isRollback(h.status, next))
                      .slice(0, 1)
                      .map((next) => (
                        <Button
                          key={next}
                          size="sm"
                          variant="outline"
                          disabled={changeStatus.isPending}
                          onClick={() => transition(h, next)}
                        >
                          {TRANSITION_LABELS[next]}
                        </Button>
                      ))}
                    <Menu
                      trigger={({ open, toggle }) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Plus d’actions"
                          aria-expanded={open}
                          onClick={toggle}
                        >
                          <MoreHorizontal />
                        </Button>
                      )}
                    >
                      <MenuLabel>Statut</MenuLabel>
                      {STATUS_TRANSITIONS[h.status].map((next) => (
                        <MenuItem
                          key={next}
                          disabled={changeStatus.isPending}
                          onClick={() => transition(h, next)}
                        >
                          {isRollback(h.status, next) ? <Undo2 /> : <ArrowRight />}
                          {TRANSITION_LABELS[next]}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuLink to={`/hackathons/${h.slug}`}>
                        <Eye /> Voir la page
                      </MenuLink>
                      <MenuLink to={`/admin/hackathons/${h.slug}/edit`}>
                        <Pencil /> Modifier
                      </MenuLink>
                      <MenuLink to={`/admin/hackathons/new?from=${h.slug}`}>
                        <CopyPlus /> Dupliquer
                      </MenuLink>
                      <MenuLink to={`/hackathons/${h.slug}/results`}>
                        <Trophy /> Résultats
                      </MenuLink>
                      <MenuLink to={`/jury/${h.slug}`}>
                        <ClipboardList /> Grille du jury
                      </MenuLink>
                      <MenuItem onClick={() => setQrFor(h)}>
                        <QrCode /> QR code
                      </MenuItem>
                    </Menu>
                  </div>
                </Td>
              </tr>
            ))}
            {hackathons && hackathons.length === 0 && (
              <tr>
                <Td colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucun hackathon.{' '}
                  <Link to="/admin/hackathons/new" className="text-primary hover:underline">
                    Crée le premier
                  </Link>
                  .
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold tracking-tight">Par statut</h2>
          <ul className="mt-3 divide-y text-sm">
            {stats &&
              (Object.keys(stats.byStatus) as HackathonStatus[]).map((status) => (
                <li key={status} className="flex items-center justify-between py-2">
                  <StatusBadge status={status} />
                  <span className="font-mono">{stats.byStatus[status]}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold tracking-tight">Activité récente</h2>
          {stats && stats.activity.length > 0 ? (
            <ul className="mt-3 divide-y text-sm">
              {stats.activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-start gap-3 py-2">
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      a.type === 'submission'
                        ? 'bg-[color:var(--brand-3)]'
                        : a.type === 'registration'
                          ? 'bg-primary'
                          : a.type === 'question' || a.type === 'feedback'
                            ? 'bg-[color:var(--brand-2)]'
                            : 'bg-muted-foreground',
                    )}
                  />
                  <p className="min-w-0 flex-1">
                    <span className="font-medium">{a.pseudo}</span> {a.label}
                    {a.hackathonSlug && (
                      <>
                        {' '}
                        <Link
                          to={`/hackathons/${a.hackathonSlug}`}
                          className="text-primary hover:underline"
                        >
                          {a.hackathonTitle}
                        </Link>
                      </>
                    )}
                    <span className="block text-xs text-muted-foreground">{fromNow(a.at)}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Rien pour l’instant.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <FolderArchive className="size-5" /> Base de connaissance
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Régénère l’index, les README (avec le classement) et les manifests dans{' '}
              <span className="font-mono">storage/</span>, puis crée un commit Git dans ce dossier
              (dépôt initialisé au besoin). Aussi en ligne de commande :{' '}
              <span className="font-mono">npm run kb:export -- --commit</span>.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={kbExport.isPending} onClick={() => exportKb(false)}>
              Régénérer les README
            </Button>
            <Button disabled={kbExport.isPending} onClick={() => exportKb(true)}>
              <GitCommitHorizontal /> Régénérer + commit Git
            </Button>
          </div>
        </div>
      </section>

      {qrFor && (
        <QrDialog
          open
          onClose={() => setQrFor(null)}
          path={`/hackathons/${qrFor.slug}`}
          title={`« ${qrFor.title} »`}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Les brouillons ne sont visibles que d’ici. Publier un hackathon le rend visible à tous ; «
        Lancer » ouvre les dépôts (le scheduler le fait aussi tout seul aux dates prévues).{' '}
        <Link
          to="/hackathons"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Vue participant <ArrowRight className="size-3" />
        </Link>
      </p>
    </div>
  );
}
