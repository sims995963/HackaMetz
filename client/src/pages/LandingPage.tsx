import type { HackathonWithCounts } from '@hackametz/shared';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  FolderArchive,
  GitCommitHorizontal,
  Heart,
  LayoutDashboard,
  LogIn,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import { Link, useOutletContext } from 'react-router';
import type { ShellContext } from '@/components/layout/AppShell';
import { Countdown } from '@/components/hackathon/Countdown';
import { HackathonCard } from '@/components/hackathon/HackathonCard';
import { StatusBadge } from '@/components/hackathon/StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import { useHackathons } from '@/hooks/useHackathons';
import { useSession } from '@/hooks/useSession';
import { usePublicStats } from '@/hooks/useStats';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    icon: UserRound,
    title: 'Entre avec un pseudo',
    text: 'Pas de compte, pas de mot de passe : ton pseudo est lié à ton appareil.',
  },
  {
    icon: Sparkles,
    title: 'Rejoins un hackathon',
    text: 'Thème, règlement, dates, critères, équipes : tout est sur la page de l’édition.',
  },
  {
    icon: Upload,
    title: 'Dépose ton projet',
    text: 'Glisse un dossier ou un zip. Ton code est archivé, versionné, consultable.',
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Pseudo seul, appareil lié',
    text: 'Zéro friction pour entrer, et personne ne peut reprendre ton pseudo sur un autre appareil.',
  },
  {
    icon: Upload,
    title: 'Dépôt par glisser-déposer',
    text: 'node_modules, .git et .env sont filtrés avant l’envoi. Re-dépôt possible jusqu’à la deadline.',
  },
  {
    icon: Users,
    title: 'Équipes par code',
    text: 'Un code à six caractères à dicter, une taille min/max par hackathon, un dépôt par équipe.',
  },
  {
    icon: Bell,
    title: 'Annonces en direct',
    text: 'Les annonces, inscriptions et dépôts arrivent sur la page sans recharger.',
  },
  {
    icon: Trophy,
    title: 'Jury, podium et coup de cœur',
    text: 'Critères pondérés, grille de notation, classement publié, vote du public.',
  },
  {
    icon: FolderArchive,
    title: 'Base de connaissance Git',
    text: 'Chaque édition rangée dans un dossier numéroté, README et manifests générés, commit en un clic.',
  },
];

const ORGANIZER = [
  {
    icon: LayoutDashboard,
    text: 'Un dashboard : inscrits, projets, activité, statuts en un coup d’œil',
  },
  { icon: Zap, text: 'Les statuts changent tout seuls aux dates prévues (début, deadline)' },
  { icon: QrCode, text: 'Un QR code de l’édition à projeter au kickoff' },
  { icon: GitCommitHorizontal, text: 'Export Git de la base de connaissance en un bouton' },
];

export function LandingPage() {
  const { openPseudoDialog } = useOutletContext<ShellContext>();
  const { isLoggedIn } = useSession();
  const { data: hackathons } = useHackathons();
  const { data: stats } = usePublicStats();

  const visible = (hackathons ?? []).filter((h) => h.status !== 'draft');
  const live = visible.find((h) => h.status === 'running');
  const next = visible.find((h) => h.status === 'published');
  const featured = live ?? next ?? visible[0];
  const recent = visible.filter((h) => h.id !== featured?.id).slice(0, 3);
  /** Instance toute neuve : aucune édition publiée. */
  const isEmpty = visible.length === 0;

  return (
    <div className="flex flex-col gap-20">
      {/* ------------------------------------------------------------ Hero */}
      <section className="hero-mesh relative overflow-hidden rounded-[28px] text-white shadow-pop">
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="orb -left-20 -top-24 size-80 bg-brand-1" aria-hidden />
        <div
          className="orb -right-16 top-10 size-72 bg-brand-2 [animation-delay:-5s]"
          aria-hidden
        />
        <div
          className="orb -bottom-24 left-1/2 size-80 bg-brand-3 [animation-delay:-9s]"
          aria-hidden
        />

        <div className="relative grid gap-12 px-7 py-14 sm:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand-3" />
              La plateforme des hackathons de Metz
            </p>
            <h1 className="text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl xl:text-6xl">
              Un pseudo. Un projet.
              <br />
              <span className="text-brand">Une base qui grandit.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              HackaMetz accueille chaque édition de bout en bout : inscription en un pseudo,
              équipes, dépôt du projet par glisser-déposer, jury, podium — et une base de
              connaissance versionnée qui capitalise le travail des participants.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isLoggedIn ? (
                <Link
                  to="/hackathons"
                  className={cn(
                    buttonVariants({ size: 'lg' }),
                    'bg-white text-[#0b1020] shadow-pop hover:bg-white/90 hover:brightness-100',
                  )}
                >
                  Voir les hackathons <ArrowRight />
                </Link>
              ) : (
                <Button
                  size="lg"
                  className="bg-white text-[#0b1020] shadow-pop hover:bg-white/90 hover:brightness-100"
                  onClick={openPseudoDialog}
                >
                  <LogIn /> Entrer avec un pseudo
                </Button>
              )}
              <Link
                to="/kb"
                className={cn(
                  buttonVariants({ size: 'lg', variant: 'outline' }),
                  'border-white/25 bg-white/5 text-white shadow-none hover:border-white/40 hover:bg-white/10 hover:text-white',
                )}
              >
                <FolderArchive /> Explorer les projets
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {[
                'Sans compte ni mot de passe',
                'Fonctionne en réseau local',
                'Code archivé sous licence libre',
              ].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-brand-3" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <HeroPreview hackathon={featured} />
        </div>
      </section>

      {/* ------------------------------------------------------------ Chiffres */}
      {stats && (
        <section className="-mt-8">
          <dl className="glass grid grid-cols-2 divide-border/60 rounded-2xl border border-border/60 shadow-soft sm:grid-cols-4 sm:divide-x">
            {[
              [stats.hackathons, 'hackathons organisés'],
              [stats.running, 'en cours en ce moment'],
              [stats.participants, 'participants uniques'],
              [stats.submissions, 'projets archivés'],
            ].map(([value, label]) => (
              <div key={label} className="px-6 py-5">
                <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
                <dt className="mt-0.5 text-sm text-muted-foreground">{label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ------------------------------------------------------------ En ce moment */}
      {featured && (
        <section>
          <SectionHeader
            eyebrow={live ? 'En ce moment' : next ? 'Prochaine édition' : 'Dernière édition'}
            title={featured.title}
            action={
              <Link to="/hackathons" className="text-sm font-medium text-primary hover:underline">
                Tous les hackathons →
              </Link>
            }
          />
          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Link
              to={`/hackathons/${featured.slug}`}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-7 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift sm:p-8"
            >
              <div
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: featured.coverColor }}
              />
              <div className="flex items-center gap-3">
                <StatusBadge status={featured.status} />
                <span className="font-mono text-xs text-muted-foreground">#{featured.code}</span>
              </div>
              <p className="mt-4 text-lg text-muted-foreground">{featured.theme}</p>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <Countdown
                  targetIso={
                    featured.status === 'running'
                      ? featured.dates.submissionDeadlineAt
                      : featured.dates.startsAt
                  }
                  label={
                    featured.status === 'running'
                      ? 'Deadline de dépôt'
                      : featured.status === 'published'
                        ? 'Début'
                        : 'Édition terminée'
                  }
                />
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {featured.status === 'running' ? 'Déposer mon projet' : 'Voir l’édition'}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
            <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
              <p className="text-sm font-semibold">En chiffres</p>
              <ul className="mt-3 divide-y divide-border/60 text-sm">
                <Row label="Participants" value={featured.counts.participants} />
                <Row label="Projets déposés" value={featured.counts.submissions} />
                <Row
                  label="Équipes"
                  value={
                    featured.team.enabled
                      ? `${featured.team.minSize}–${featured.team.maxSize} pers.`
                      : 'solo'
                  }
                />
                <Row label="Critères" value={featured.criteria.length} />
                <Row
                  label="Dossier"
                  value={
                    <span className="font-mono text-xs">
                      {featured.storagePath.split('/').pop()}
                    </span>
                  }
                />
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Comment ça marche */}
      <section>
        <SectionHeader eyebrow="Pour les participants" title="Trois étapes, zéro friction" />
        <ol className="relative grid gap-5 md:grid-cols-3">
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-px bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 opacity-40 md:block"
            aria-hidden
          />
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="relative rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-lift">
                  <Icon className="size-5" />
                </span>
                <span className="font-display text-3xl font-bold text-muted-foreground/40">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------ Fonctionnalités */}
      <section>
        <SectionHeader
          eyebrow="Tout est là"
          title="Ce qu’il faut pour faire tourner un hackathon"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-brand group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ Organisateur */}
      <section className="grid items-center gap-10 rounded-[28px] border border-border/70 bg-card p-7 shadow-soft sm:p-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-brand">Pour l’organisateur</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Piloter une édition sans quitter le dashboard
          </h2>
          <p className="mt-3 text-muted-foreground">
            Création avec tous les paramètres — dates, équipes, limites de dépôt, critères, prix,
            jury — puis le cycle de vie se déroule tout seul.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {ORGANIZER.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-brand text-white">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <Link to="/admin" className={cn(buttonVariants({ variant: 'outline' }), 'mt-7')}>
            Ouvrir l’espace organisateur <ArrowRight />
          </Link>
        </div>
        <DashboardMock stats={stats} hackathons={visible} />
      </section>

      {/* ------------------------------------------------------------ Base de connaissance */}
      <section className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-[#0b1020] p-6 text-xs leading-relaxed text-white/80 shadow-pop">
          <code>{`storage/
├── README.md              ← index de toutes les éditions
└── hackathons/
    ├── 001-ia-pour-l-education/
    │   ├── hackathon.json
    │   ├── README.md      ← thème, participants, classement
    │   └── projects/
    │       ├── 01-alice/
    │       │   ├── project.json
    │       │   ├── source/
    │       │   └── archives/v1.zip
    │       └── 02-bob/
    └── 002-ville-durable/`}</code>
        </pre>
        <div>
          <p className="text-sm font-semibold text-brand">Base de connaissance</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Chaque projet trouve sa place dans un dossier numéroté
          </h2>
          <p className="mt-3 text-muted-foreground">
            Le code des participants, leur pitch, leur archive d’origine et un README généré sont
            rangés dans un dossier par édition, prêt à être versionné sur Git. Les secrets sont
            filtrés à l’extraction, le consentement et la licence sont enregistrés avec chaque
            dépôt.
          </p>
          <Link to="/kb" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
            Parcourir les archives <ArrowRight />
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------ Dernières éditions */}
      {recent.length > 0 && (
        <section>
          <SectionHeader
            eyebrow="Éditions"
            title="Dernières éditions"
            action={
              <Link to="/hackathons" className="text-sm font-medium text-primary hover:underline">
                Tout voir →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((h) => (
              <HackathonCard key={h.id} hackathon={h} />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ CTA */}
      <section className="relative overflow-hidden rounded-[28px] bg-brand p-8 text-white shadow-pop sm:p-12">
        <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {isEmpty ? 'Aucune édition pour l’instant' : 'Prêt pour la prochaine édition ?'}
            </h2>
            <p className="mt-2 max-w-xl text-white/85">
              {isEmpty
                ? 'La première édition sera annoncée ici. Organisateur ? Crée-la depuis l’espace dédié.'
                : 'Entre avec un pseudo, rejoins l’édition en cours ou prépare la tienne depuis l’espace organisateur.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {isEmpty && (
              <Link
                to="/admin/hackathons/new"
                className={cn(
                  buttonVariants({ size: 'lg' }),
                  'bg-white text-[#0b1020] shadow-none hover:bg-white/90 hover:brightness-100',
                )}
              >
                <Plus /> Créer la première édition
              </Link>
            )}
            {!isEmpty && !isLoggedIn && (
              <Button
                size="lg"
                className="bg-white text-[#0b1020] shadow-none hover:bg-white/90 hover:brightness-100"
                onClick={openPseudoDialog}
              >
                <LogIn /> Entrer
              </Button>
            )}
            <Link
              to="/hackathons"
              className={cn(
                buttonVariants({ size: 'lg', variant: 'outline' }),
                'border-white/30 bg-white/10 text-white shadow-none hover:bg-white/20 hover:text-white',
              )}
            >
              Les hackathons <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-brand">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </li>
  );
}

/** Aperçu produit : trois panneaux flottants inspirés des vraies pages, sur les données de l'édition mise en avant. */
function HeroPreview({ hackathon }: { hackathon?: HackathonWithCounts }) {
  /** Sans édition réelle, les chiffres affichés sont une illustration : on l'annonce. */
  const isExample = hackathon === undefined;
  const title = hackathon?.title ?? 'Ville durable';
  const code = hackathon?.code ?? '002';
  const participants = hackathon?.counts.participants ?? 24;
  const submissions = hackathon?.counts.submissions ?? 9;
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-md lg:h-[420px]" aria-hidden>
      <div className="absolute left-0 top-6 w-[78%] rounded-2xl border border-white/15 bg-white/[0.08] p-5 shadow-pop backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" /> En cours
          </span>
          <span className="font-mono text-[11px] text-white/50">
            {isExample ? 'exemple' : `#${code}`}
          </span>
        </div>
        <p className="mt-3 font-display text-xl font-bold">{title}</p>
        <div className="mt-4 flex gap-2">
          {[
            ['01', 'j'],
            ['18', 'h'],
            ['42', 'min'],
          ].map(([v, u]) => (
            <div
              key={u}
              className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-center"
            >
              <div className="font-mono text-lg font-semibold leading-none">{v}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wider text-white/50">{u}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-[11px] text-white/60">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {participants} inscrits
          </span>
          <span className="inline-flex items-center gap-1">
            <FolderArchive className="size-3" /> {submissions} projets
          </span>
        </div>
      </div>

      <div className="absolute right-0 top-0 w-[58%] animate-float rounded-2xl border border-white/15 bg-white/[0.1] p-4 shadow-pop backdrop-blur-xl [animation-delay:-3s]">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-brand">
            <Upload className="size-3.5" />
          </span>
          Dépôt en cours
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-white/60">
          metro-leger.zip · 1,2 Mo
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[72%] rounded-full bg-brand" />
        </div>
        <p className="mt-1.5 text-[10px] text-white/50">
          node_modules et .env exclus · 214 fichiers
        </p>
      </div>

      <div className="absolute bottom-0 right-4 w-[64%] rounded-2xl border border-white/15 bg-white/[0.1] p-4 shadow-pop backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="size-3.5 text-brand-3" /> Classement
          </span>
          <span className="inline-flex items-center gap-1 text-white/60">
            <Heart className="size-3 fill-current text-pink-300" /> 12
          </span>
        </div>
        <ul className="mt-2.5 flex flex-col gap-1.5 text-[11px]">
          {[
            ['1', 'Tuteur IA', '83.8'],
            ['2', 'QuizFlash', '76.3'],
            ['3', 'Métro léger', '71.0'],
          ].map(([r, t, s]) => (
            <li key={t} className="flex items-center gap-2 rounded-lg bg-black/25 px-2 py-1.5">
              <span
                className={cn('font-mono font-bold', r === '1' ? 'text-brand-3' : 'text-white/50')}
              >
                #{r}
              </span>
              <span className="flex-1 truncate">{t}</span>
              <span className="font-mono text-white/70">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Maquette du dashboard organisateur, alimentée par les vraies données quand elles existent. */
function DashboardMock({
  stats,
  hackathons,
}: {
  stats?: { hackathons: number; participants: number; submissions: number };
  hackathons: HackathonWithCounts[];
}) {
  const rows = hackathons.slice(0, 3);
  const fallbackTitles = ['Ville durable', 'IA pour l’éducation', 'Santé & bien-être'];
  return (
    <div
      className="rounded-2xl border border-border/70 bg-background/60 p-4 shadow-lift"
      aria-hidden
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Hackathons', stats?.hackathons ?? 3],
          ['Participants', stats?.participants ?? 42],
          ['Projets', stats?.submissions ?? 17],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-card p-3">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-card">
        {(rows.length > 0 ? rows : [null, null, null]).map((h, i) => (
          <div
            key={h?.id ?? i}
            className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 text-xs last:border-b-0"
          >
            <span className="font-mono text-muted-foreground">{h?.code ?? `00${3 - i}`}</span>
            <span className="flex-1 truncate font-medium">{h?.title ?? fallbackTitles[i]}</span>
            {h ? (
              <StatusBadge status={h.status} />
            ) : (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px]">—</span>
            )}
            <span className="font-mono text-muted-foreground">{h?.counts.submissions ?? 0}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 truncate text-muted-foreground">
          <Bell className="size-3.5 shrink-0" /> Annonce : « Pizza à 20 h, salle B »
        </span>
        <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
          envoyée en direct
        </span>
      </div>
    </div>
  );
}
