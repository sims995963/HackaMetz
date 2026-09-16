import { useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { submissionMetaSchema } from '@hackametz/shared';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  RotateCcw,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { uploadSubmission } from '@/api/submissions.api';
import { Countdown } from '@/components/hackathon/Countdown';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useHackathon } from '@/hooks/useHackathons';
import { useMe } from '@/hooks/useMe';
import { useInvalidateAfterSubmit } from '@/hooks/useParticipation';
import { useSession } from '@/hooks/useSession';
import { useMyTeam } from '@/hooks/useTeams';
import {
  buildArchive,
  collectFromDrop,
  collectFromInput,
  formatBytes,
  type Collection,
} from '@/lib/project-files';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'reading' | 'ready' | 'zipping' | 'uploading' | 'done';

interface FormState {
  title: string;
  pitch: string;
  techStack: string;
  repoUrl: string;
  demoUrl: string;
  videoUrl: string;
  consentPublish: boolean;
}

export function SubmitPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useSession();
  const { data: h } = useHackathon(slug);
  const { data: me } = useMe();
  const { data: myTeam, isPending: teamPending } = useMyTeam(slug);
  const invalidate = useInvalidateAfterSubmit(slug);
  const id = useId();

  const [phase, setPhase] = useState<Phase>('idle');
  const [dragging, setDragging] = useState(false);
  /** Fichiers refusés par le scan de secrets (mode strict). */
  const [blockedFiles, setBlockedFiles] = useState<string[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    title: '',
    pitch: '',
    techStack: '',
    repoUrl: '',
    demoUrl: '',
    videoUrl: '',
    consentPublish: false,
  });
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  if (!isLoggedIn) return <Navigate to={`/hackathons/${slug}`} replace />;
  if (!h)
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;

  const existing = me?.submissions.find((s) => s.hackathon.id === h.id);
  const needsTeam = h.team.enabled && !teamPending && !myTeam;
  const teamTooSmall = h.team.enabled && myTeam ? myTeam.members.length < h.team.minSize : false;
  const maxBytes = h.submission.maxSizeMb * 1024 * 1024;
  const tooBig = collection !== null && collection.totalBytes > maxBytes;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    setPhase('reading');
    try {
      const collected = await collectFromDrop(event.dataTransfer);
      applyCollection(collected);
    } catch {
      toast.error('Impossible de lire ce qui a été déposé');
      setPhase('idle');
    }
  }

  function applyCollection(collected: Collection) {
    if (collected.files.length === 0) {
      toast.error('Aucun fichier exploitable (tout a été filtré ?)');
      setPhase('idle');
      return;
    }
    setCollection(collected);
    if (!form.title && !collected.isArchive) {
      const root = collected.files[0]?.path.split('/')[0];
      if (root && collected.files.every((f) => f.path.startsWith(`${root}/`))) set('title', root);
    }
    setPhase('ready');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!collection || !h) return;

    const meta = {
      title: form.title,
      pitch: form.pitch,
      description: '',
      techStack: form.techStack
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      repoUrl: form.repoUrl,
      demoUrl: form.demoUrl,
      videoUrl: form.videoUrl,
      consentPublish: form.consentPublish,
    };
    const parsed = submissionMetaSchema.safeParse(meta);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }

    try {
      setPhase('zipping');
      setProgress(0);
      const archive = await buildArchive(collection, (f) => setProgress(f * 100));
      if (archive.size > maxBytes) {
        toast.error(
          `Archive de ${formatBytes(archive.size)} : la limite est ${h.submission.maxSizeMb} Mo`,
        );
        setPhase('ready');
        return;
      }
      setPhase('uploading');
      setProgress(0);
      const { submission } = await uploadSubmission(
        slug,
        archive,
        meta as typeof meta & { consentPublish: true },
        {
          onProgress: (f) => setProgress(f * 100),
        },
      );
      invalidate();
      setPhase('done');
      toast.success(existing ? 'Projet mis à jour !' : 'Projet déposé !');
      navigate(`/hackathons/${slug}/projects/${submission.id}`);
    } catch (err) {
      setPhase('ready');
      if (err instanceof ApiError) {
        toast.error(err.message);
        // Secrets détectés : les chemins fautifs ne correspondent à aucun champ du formulaire,
        // on les affiche à part pour que le déposant sache quoi retirer.
        if (err.code === 'CONFLICT' && err.details?.length) {
          setBlockedFiles(err.details.map((d) => `${d.path} — ${d.message}`));
        } else if (err.details) {
          const next: Record<string, string> = {};
          for (const d of err.details) next[d.path] = d.message;
          setErrors(next);
        }
      } else {
        toast.error('Le dépôt a échoué, réessaie.');
      }
    }
  }

  const busy = phase === 'zipping' || phase === 'uploading' || phase === 'reading';

  const ready = collection !== null && !tooBig;
  const checklist = [
    {
      done: ready,
      label: collection
        ? tooBig
          ? `Trop volumineux (max ${h.submission.maxSizeMb} Mo)`
          : `${collection.isArchive ? 'Archive' : `${collection.files.length} fichiers`} · ${formatBytes(collection.totalBytes)}`
        : 'Dossier ou zip à ajouter',
    },
    { done: form.title.trim().length > 0, label: 'Titre du projet' },
    ...(h.team.enabled
      ? [
          {
            done: Boolean(myTeam) && !teamTooSmall,
            label: myTeam ? `Équipe ${myTeam.name}` : 'Équipe à rejoindre',
          },
        ]
      : []),
    { done: form.consentPublish, label: 'Autorisation de publication' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Link
        to={`/hackathons/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {h.title}
      </Link>

      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          {existing ? 'Mettre à jour mon projet' : 'Déposer mon projet'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Glisse le dossier de ton projet ou un zip. <span className="font-mono">node_modules</span>
          , <span className="font-mono">.git</span> et les fichiers{' '}
          <span className="font-mono">.env</span> sont exclus automatiquement. Limite :{' '}
          {h.submission.maxSizeMb} Mo, {h.submission.maxFiles} fichiers.
        </p>
        {h.team.enabled && myTeam && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" /> Dépôt au nom de l’équipe <strong>{myTeam.name}</strong> (
            {myTeam.members.map((m) => m.pseudo).join(', ')})
          </p>
        )}
        {(needsTeam || teamTooSmall) && (
          <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {needsTeam
              ? 'Ce hackathon se joue en équipe : crée ou rejoins une équipe avant de déposer.'
              : `Ton équipe doit compter au moins ${h.team.minSize} membres pour déposer.`}{' '}
            <Link to={`/hackathons/${slug}`} className="underline">
              Voir les équipes
            </Link>
          </p>
        )}
        {existing && (
          <p className="mt-2 text-sm text-warning">
            Tu as déjà déposé « {existing.title} » (v{existing.version}). Ce nouveau dépôt deviendra
            la version {existing.version + 1} ; les précédentes sont conservées.
          </p>
        )}
      </header>

      {blockedFiles.length > 0 && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="size-4" /> Dépôt refusé : des secrets ont été détectés
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Retire ces valeurs (ou déplace-les dans un fichier{' '}
            <span className="font-mono">.env</span>, exclu automatiquement), puis redépose.
          </p>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-destructive">
            {blockedFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start"
      >
        <div className="flex flex-col gap-8">
          {/* Zone de dépôt */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={busy ? (e) => e.preventDefault() : handleDrop}
            className={cn(
              'relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
              dragging ? 'border-primary bg-accent/60' : 'border-border bg-card',
              collection && 'border-solid',
            )}
          >
            {phase === 'reading' && (
              <p className="text-sm text-muted-foreground">Lecture du dossier…</p>
            )}

            {!collection && phase !== 'reading' && (
              <>
                <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-brand text-white">
                  <Upload className="size-6" />
                </span>
                <p className="mt-4 font-medium">Glisse ton dossier ou ton zip ici</p>
                <p className="mt-1 text-sm text-muted-foreground">ou choisis-le :</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => folderInput.current?.click()}
                  >
                    <FolderOpen /> Un dossier
                  </Button>
                  <Button type="button" variant="outline" onClick={() => zipInput.current?.click()}>
                    <FileArchive /> Un zip
                  </Button>
                </div>
                <input
                  ref={folderInput}
                  type="file"
                  className="hidden"
                  multiple
                  // @ts-expect-error attribut non standard mais supporté par tous les navigateurs récents
                  webkitdirectory=""
                  onChange={(e) =>
                    e.target.files && applyCollection(collectFromInput(e.target.files))
                  }
                />
                <input
                  ref={zipInput}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && applyCollection(collectFromInput(e.target.files))
                  }
                />
              </>
            )}

            {collection && (
              <div className="text-left">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex size-10 items-center justify-center rounded-xl text-white',
                        tooBig ? 'bg-destructive' : 'bg-brand',
                      )}
                    >
                      {collection.isArchive ? (
                        <FileArchive className="size-5" />
                      ) : (
                        <CheckCircle2 className="size-5" />
                      )}
                    </span>
                    <div>
                      <p className="font-medium">
                        {collection.isArchive
                          ? collection.files[0]?.file.name
                          : `${collection.files.length} fichier${collection.files.length > 1 ? 's' : ''} prêt${collection.files.length > 1 ? 's' : ''}`}
                      </p>
                      <p
                        className={cn(
                          'text-sm',
                          tooBig ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {formatBytes(collection.totalBytes)}
                        {tooBig && ` — dépasse la limite de ${h.submission.maxSizeMb} Mo`}
                        {collection.skipped.length > 0 &&
                          ` · ${collection.skipped.length} élément${collection.skipped.length > 1 ? 's' : ''} exclu${collection.skipped.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setCollection(null);
                      setPhase('idle');
                    }}
                  >
                    <RotateCcw /> Changer
                  </Button>
                </div>
                {collection.skipped.length > 0 && (
                  <details className="mt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Éléments exclus</summary>
                    <ul className="mt-1 max-h-32 overflow-y-auto font-mono">
                      {collection.skipped.slice(0, 50).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                      {collection.skipped.length > 50 && (
                        <li>… et {collection.skipped.length - 50} autres</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Métadonnées */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Titre du projet"
              htmlFor={`${id}-title`}
              error={errors.title}
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-title`}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={120}
                required
              />
            </Field>
            <Field
              label="Pitch"
              htmlFor={`${id}-pitch`}
              hint="Une ou deux phrases : le problème, ta solution."
              error={errors.pitch}
              className="sm:col-span-2"
            >
              <Textarea
                id={`${id}-pitch`}
                value={form.pitch}
                onChange={(e) => set('pitch', e.target.value)}
                maxLength={600}
              />
            </Field>
            <Field
              label="Technos"
              htmlFor={`${id}-tech`}
              hint="Séparées par des virgules"
              error={errors.techStack}
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-tech`}
                value={form.techStack}
                onChange={(e) => set('techStack', e.target.value)}
                placeholder="React, Node, PostgreSQL"
              />
            </Field>
            <Field label="Dépôt Git (optionnel)" htmlFor={`${id}-repo`} error={errors.repoUrl}>
              <Input
                id={`${id}-repo`}
                type="url"
                value={form.repoUrl}
                onChange={(e) => set('repoUrl', e.target.value)}
                placeholder="https://github.com/…"
              />
            </Field>
            <Field label="Démo en ligne (optionnel)" htmlFor={`${id}-demo`} error={errors.demoUrl}>
              <Input
                id={`${id}-demo`}
                type="url"
                value={form.demoUrl}
                onChange={(e) => set('demoUrl', e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field
              label="Vidéo (optionnel)"
              htmlFor={`${id}-video`}
              error={errors.videoUrl}
              className="sm:col-span-2"
            >
              <Input
                id={`${id}-video`}
                type="url"
                value={form.videoUrl}
                onChange={(e) => set('videoUrl', e.target.value)}
                placeholder="https://youtube.com/…"
              />
            </Field>
          </div>

          <label
            htmlFor={`${id}-consent`}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card p-4 text-sm"
          >
            <Checkbox
              id={`${id}-consent`}
              checked={form.consentPublish}
              onChange={(e) => set('consentPublish', e.target.checked)}
              className="mt-0.5"
            />
            <span>
              J’autorise la publication de ce code dans la base de connaissance HackaMetz, sous
              licence <strong>{h.submission.license}</strong>. Je confirme qu’il ne contient ni
              secret ni donnée personnelle.
              {errors.consentPublish && (
                <span className="mt-1 block text-destructive">{errors.consentPublish}</span>
              )}
            </span>
          </label>
        </div>

        {/* Récapitulatif collant : ce qu'il reste à faire avant d'envoyer. */}
        <aside className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft lg:sticky lg:top-6">
          <div>
            <h2 className="font-semibold">Prêt à déposer ?</h2>
            <Countdown
              compact
              className="mt-1 block"
              targetIso={h.dates.submissionDeadlineAt}
              label="Deadline dans"
            />
          </div>

          <ul className="flex flex-col gap-2 text-sm">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
                    item.done
                      ? 'border-transparent bg-brand text-white'
                      : 'border-border text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="size-3 stroke-[3]" />
                </span>
                <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          {(phase === 'zipping' || phase === 'uploading') && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>{phase === 'zipping' ? 'Compression…' : 'Envoi…'}</span>
                <span className="font-mono">{Math.round(progress)} %</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!collection || tooBig || busy || needsTeam || teamTooSmall}
          >
            <Upload />{' '}
            {busy
              ? 'Envoi en cours…'
              : existing
                ? `Déposer la version ${existing.version + 1}`
                : 'Déposer mon projet'}
          </Button>
          {!collection && (
            <p className="inline-flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0 translate-y-px" /> Ajoute ton dossier ou
              ton zip pour activer le dépôt.
            </p>
          )}
          <Link
            to={`/hackathons/${slug}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full' })}
          >
            Annuler
          </Link>
        </aside>
      </form>
    </div>
  );
}
