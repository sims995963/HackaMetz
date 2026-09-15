import type { HackathonWithCounts } from '@hackametz/shared';
import { ArrowRight, Check, Heart, LogIn, Upload, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useMe';
import { useSession } from '@/hooks/useSession';
import { useMyTeam } from '@/hooks/useTeams';
import { useVotes } from '@/hooks/useVotes';
import { cn } from '@/lib/utils';

interface Props {
  hackathon: HackathonWithCounts;
  onEnter: () => void;
  onJoin: () => void;
}

interface Step {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  icon: typeof Check;
  /** Action proposée quand c'est l'étape en cours. */
  action?: { label: string; to?: string; onClick?: () => void };
}

/**
 * Parcours du participant sur une édition ouverte : où il en est, et la seule
 * action qui compte maintenant. Disparaît une fois l'édition terminée.
 */
export function ParticipationChecklist({ hackathon: h, onEnter, onJoin }: Props) {
  const { isLoggedIn } = useSession();
  const { data: me } = useMe();
  const { data: myTeam } = useMyTeam(h.slug);
  const { data: votes } = useVotes(h.slug);

  const registered = me?.registrations.some((r) => r.hackathon.id === h.id) ?? false;
  const mySubmission = me?.submissions.find((s) => s.hackathon.id === h.id);
  const voteOpen = votes?.open ?? false;
  // Le dépôt n'est proposé que quand il est réellement ouvert.
  const canSubmit =
    h.status === 'running' || (h.submission.allowLate && h.status === 'submissions_closed');

  const steps: Step[] = [
    {
      key: 'pseudo',
      label: 'Entrer avec un pseudo',
      hint: 'Pas de mot de passe, juste un pseudo.',
      done: isLoggedIn,
      icon: LogIn,
      action: { label: 'Entrer', onClick: onEnter },
    },
    {
      key: 'join',
      label: 'Rejoindre l’édition',
      hint: 'Accepter le règlement pour participer.',
      done: registered,
      icon: UserPlus,
      action: { label: 'Rejoindre', onClick: onJoin },
    },
    ...(h.team.enabled
      ? [
          {
            key: 'team',
            label: myTeam ? `Équipe ${myTeam.name}` : 'Créer ou rejoindre une équipe',
            hint: `De ${h.team.minSize} à ${h.team.maxSize} personnes.`,
            done: Boolean(myTeam),
            icon: Users,
          } satisfies Step,
        ]
      : []),
    {
      key: 'submit',
      label: mySubmission ? `Projet « ${mySubmission.title} » déposé` : 'Déposer le projet',
      hint: mySubmission
        ? `Version ${mySubmission.version} — re-dépose jusqu’à la deadline.`
        : 'Glisse ton dossier ou ton zip avant la deadline.',
      done: Boolean(mySubmission),
      icon: Upload,
      action: canSubmit
        ? { label: mySubmission ? 'Mettre à jour' : 'Déposer', to: `/hackathons/${h.slug}/submit` }
        : undefined,
    },
    ...(voteOpen
      ? [
          {
            key: 'vote',
            label: 'Voter pour un coup de cœur',
            hint: 'Un vote par participant, hors son propre projet.',
            done: Boolean(votes?.mine),
            icon: Heart,
          } satisfies Step,
        ]
      : []),
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);
  const allDone = current === undefined;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold tracking-tight">Ma participation</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step) => {
          const isCurrent = step === current;
          const Icon = step.done ? Check : step.icon;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                  step.done
                    ? 'border-transparent bg-brand text-white'
                    : isCurrent
                      ? 'border-primary/50 text-primary'
                      : 'border-border text-muted-foreground',
                )}
                aria-hidden
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium',
                    !step.done && !isCurrent && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </p>
                {isCurrent && <p className="text-xs text-muted-foreground">{step.hint}</p>}
                {isCurrent &&
                  step.action &&
                  (step.action.to ? (
                    <Link
                      to={step.action.to}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      {step.action.label} <ArrowRight className="size-3.5" />
                    </Link>
                  ) : (
                    <Button size="sm" className="mt-2" onClick={step.action.onClick}>
                      {step.action.label}
                    </Button>
                  ))}
              </div>
            </li>
          );
        })}
      </ol>

      {allDone && (
        <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
          Tout est prêt — bon hackathon !
        </p>
      )}
    </section>
  );
}
