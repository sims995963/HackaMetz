import { useEffect, useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_LICENSE,
  DEFAULT_TIMEZONE,
  HACKATHON_FORMATS,
  HACKATHON_FORMAT_LABELS,
  TIE_BREAK_LABELS,
  TIE_BREAK_MODES,
  type CreateHackathonInput,
  type HackathonWithCounts,
} from '@hackametz/shared';
import { format } from 'date-fns';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { evaluationsApi } from '@/api/evaluations.api';
import { useJury } from '@/hooks/useEvaluations';
import { useCreateHackathon, useHackathon, useUpdateHackathon } from '@/hooks/useHackathons';
import { useProposalRound } from '@/hooks/useProposals';

// ---------------------------------------------------------------------------
// Schéma du formulaire : les dates sont des chaînes « datetime-local », converties en ISO à l'envoi.
// ---------------------------------------------------------------------------

const requiredDate = z.string().min(1, 'Date requise');
const optionalDate = z.string();
const positiveInt = (label: string) =>
  z
    .number({ error: `${label} : nombre requis` })
    .int(`${label} : nombre entier`)
    .min(1, `${label} : au moins 1`);

const formSchema = z
  .object({
    title: z.string().trim().min(3, 'Au moins 3 caractères').max(120),
    theme: z.string().trim().min(3, 'Au moins 3 caractères').max(200),
    description: z.string().max(20_000),
    rules: z.string().max(20_000),
    coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale, ex. #1E56D9'),
    tagsText: z.string(),
    format: z.enum(HACKATHON_FORMATS),
    location: z.string().max(200),
    timezone: z.string().min(1),
    dates: z.object({
      registrationOpensAt: optionalDate,
      startsAt: requiredDate,
      submissionDeadlineAt: requiredDate,
      endsAt: requiredDate,
      resultsAt: optionalDate,
    }),
    team: z.object({
      enabled: z.boolean(),
      minSize: positiveInt('Taille min'),
      maxSize: positiveInt('Taille max'),
    }),
    maxParticipantsText: z.string(),
    visibility: z.enum(['public', 'private']),
    accessCode: z.string().trim(),
    submission: z.object({
      zip: z.boolean(),
      folder: z.boolean(),
      maxSizeMb: positiveInt('Taille max'),
      maxFiles: positiveInt('Nombre de fichiers'),
      allowResubmit: z.boolean(),
      allowLate: z.boolean(),
      rejectSecrets: z.boolean(),
      license: z.string().trim().min(1, 'Licence requise'),
    }),
    publicVote: z.boolean(),
    tieBreakMode: z.enum(TIE_BREAK_MODES),
    tieBreakCriterionId: z.string(),
    criteria: z.array(
      z.object({
        id: z.string().optional(),
        label: z.string().trim().min(1, 'Intitulé requis').max(80),
        description: z.string().max(500),
        weight: z.number({ error: 'Poids requis' }).positive('Poids > 0'),
        maxScore: positiveInt('Note max'),
      }),
    ),
    prizes: z.array(
      z.object({
        label: z.string().trim().min(1, 'Intitulé requis').max(80),
        description: z.string().max(500),
      }),
    ),
    resources: z.array(
      z.object({
        label: z.string().trim().min(1, 'Intitulé requis').max(80),
        url: z.url('URL invalide'),
      }),
    ),
  })
  .refine((v) => new Date(v.dates.startsAt) <= new Date(v.dates.submissionDeadlineAt), {
    error: 'La deadline doit être après le début',
    path: ['dates', 'submissionDeadlineAt'],
  })
  .refine((v) => new Date(v.dates.submissionDeadlineAt) <= new Date(v.dates.endsAt), {
    error: 'La fin doit être après la deadline',
    path: ['dates', 'endsAt'],
  })
  .refine((v) => !v.team.enabled || v.team.minSize <= v.team.maxSize, {
    error: 'Taille min ≤ taille max',
    path: ['team', 'maxSize'],
  })
  .refine((v) => v.submission.zip || v.submission.folder, {
    error: 'Au moins un format',
    path: ['submission', 'folder'],
  })
  .refine((v) => v.visibility === 'public' || v.accessCode.length >= 4, {
    error: 'Code d’accès : 4 caractères minimum',
    path: ['accessCode'],
  });

type FormValues = z.infer<typeof formSchema>;

const toLocal = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '');
const toIso = (local: string) => new Date(local).toISOString();
const inDays = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
};

const EMPTY: FormValues = {
  title: '',
  theme: '',
  description: '',
  rules: '',
  coverColor: '#1E56D9',
  tagsText: '',
  format: 'onsite',
  location: '',
  timezone: DEFAULT_TIMEZONE,
  dates: {
    registrationOpensAt: '',
    startsAt: inDays(14, 9),
    submissionDeadlineAt: inDays(15, 18),
    endsAt: inDays(15, 20),
    resultsAt: '',
  },
  team: { enabled: true, minSize: 1, maxSize: 4 },
  maxParticipantsText: '',
  visibility: 'public',
  accessCode: '',
  submission: {
    zip: true,
    folder: true,
    maxSizeMb: 50,
    maxFiles: 2000,
    allowResubmit: true,
    allowLate: false,
    rejectSecrets: false,
    license: DEFAULT_LICENSE,
  },
  publicVote: true,
  tieBreakMode: 'publicVote',
  tieBreakCriterionId: '',
  criteria: [
    { label: 'Impact', description: '', weight: 2, maxScore: 10 },
    { label: 'Qualité technique', description: '', weight: 1, maxScore: 10 },
    { label: 'Démo', description: '', weight: 1, maxScore: 10 },
  ],
  prizes: [],
  resources: [],
};

function fromHackathon(h: HackathonWithCounts): FormValues {
  return {
    title: h.title,
    theme: h.theme,
    description: h.description,
    rules: h.rules,
    coverColor: h.coverColor,
    tagsText: h.tags.join(', '),
    format: h.format,
    location: h.location,
    timezone: h.timezone,
    dates: {
      registrationOpensAt: toLocal(h.dates.registrationOpensAt),
      startsAt: toLocal(h.dates.startsAt),
      submissionDeadlineAt: toLocal(h.dates.submissionDeadlineAt),
      endsAt: toLocal(h.dates.endsAt),
      resultsAt: toLocal(h.dates.resultsAt),
    },
    team: h.team,
    maxParticipantsText: h.maxParticipants ? String(h.maxParticipants) : '',
    visibility: h.visibility,
    accessCode: h.accessCode ?? '',
    submission: {
      zip: h.submission.formats.includes('zip'),
      folder: h.submission.formats.includes('folder'),
      maxSizeMb: h.submission.maxSizeMb,
      maxFiles: h.submission.maxFiles,
      allowResubmit: h.submission.allowResubmit,
      allowLate: h.submission.allowLate,
      rejectSecrets: h.submission.rejectSecrets ?? false,
      license: h.submission.license,
    },
    publicVote: h.publicVote ?? false,
    tieBreakMode: h.tieBreak?.mode ?? 'publicVote',
    tieBreakCriterionId: h.tieBreak?.criterionId ?? '',
    criteria: h.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
    })),
    prizes: h.prizes.map((p) => ({ label: p.label, description: p.description })),
    resources: h.resources.map((r) => ({ label: r.label, url: r.url })),
  };
}

function toPayload(v: FormValues): CreateHackathonInput {
  const maxParticipants = Number.parseInt(v.maxParticipantsText, 10);
  return {
    title: v.title,
    theme: v.theme,
    description: v.description,
    rules: v.rules,
    coverColor: v.coverColor,
    tags: v.tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    format: v.format,
    location: v.location,
    timezone: v.timezone,
    dates: {
      registrationOpensAt: v.dates.registrationOpensAt ? toIso(v.dates.registrationOpensAt) : null,
      startsAt: toIso(v.dates.startsAt),
      submissionDeadlineAt: toIso(v.dates.submissionDeadlineAt),
      endsAt: toIso(v.dates.endsAt),
      resultsAt: v.dates.resultsAt ? toIso(v.dates.resultsAt) : null,
    },
    team: v.team,
    maxParticipants:
      Number.isFinite(maxParticipants) && maxParticipants > 0 ? maxParticipants : null,
    visibility: v.visibility,
    accessCode: v.visibility === 'private' ? v.accessCode : null,
    submission: {
      formats: [
        ...(v.submission.zip ? ['zip' as const] : []),
        ...(v.submission.folder ? ['folder' as const] : []),
      ],
      maxSizeMb: v.submission.maxSizeMb,
      maxFiles: v.submission.maxFiles,
      allowResubmit: v.submission.allowResubmit,
      allowLate: v.submission.allowLate,
      rejectSecrets: v.submission.rejectSecrets,
      license: v.submission.license,
      requiredFields: ['pitch', 'techStack'],
    },
    publicVote: v.publicVote,
    tieBreak: {
      mode: v.tieBreakMode,
      criterionId: v.tieBreakMode === 'criterion' ? v.tieBreakCriterionId || null : null,
    },
    criteria: v.criteria,
    prizes: v.prizes.map((p, i) => ({ rank: i + 1, label: p.label, description: p.description })),
    resources: v.resources,
  };
}

// ---------------------------------------------------------------------------

export function HackathonFormPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const roundId = params.get('round') ?? '';
  // `?from=slug` : duplication d'une édition — tous les réglages, dates remises à zéro.
  const fromSlug = params.get('from') ?? '';
  const editing = Boolean(slug);
  const { data: existing } = useHackathon(slug ?? '');
  const { data: source } = useHackathon(fromSlug);
  const { data: sourceJury } = useJury(fromSlug);
  const { data: round } = useProposalRound(roundId);

  if ((editing && !existing) || (roundId && !round) || (fromSlug && !source))
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
  const winner = round?.proposals.find((p) => p.id === round.winnerProposalId);
  const seed: Partial<FormValues> | undefined = winner
    ? {
        title: winner.title,
        theme: winner.theme,
        description: winner.description,
        tagsText: winner.tags.join(', '),
        coverColor: winner.coverColor.toUpperCase(),
      }
    : source
      ? { ...duplicateOf(source) }
      : undefined;
  return (
    <HackathonForm
      key={existing?.id ?? roundId ?? source?.id ?? 'new'}
      existing={existing}
      seed={seed}
      fromRoundId={winner ? roundId : undefined}
      duplicatedFrom={source && !winner ? `#${source.code} ${source.title}` : undefined}
      seedJury={source && !winner ? sourceJury?.map((j) => j.pseudo) : undefined}
    />
  );
}

/**
 * Réglages repris d'une édition passée : critères, prix, format, règlement…
 * Les dates et les identifiants de critères repartent de zéro (nouvelle édition).
 */
function duplicateOf(source: HackathonWithCounts): FormValues {
  const base = fromHackathon(source);
  return {
    ...base,
    dates: EMPTY.dates,
    accessCode: '',
    criteria: base.criteria.map(({ id: _id, ...c }) => c),
  };
}

function HackathonForm({
  existing,
  seed,
  fromRoundId,
  duplicatedFrom,
  seedJury,
}: {
  existing: HackathonWithCounts | undefined;
  seed?: Partial<FormValues>;
  fromRoundId?: string;
  duplicatedFrom?: string;
  /** Jury repris de l'édition dupliquée. */
  seedJury?: string[];
}) {
  const navigate = useNavigate();
  const id = useId();
  const create = useCreateHackathon();
  const update = useUpdateHackathon(existing?.slug ?? '');
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: existing ? fromHackathon(existing) : { ...EMPTY, ...seed },
  });
  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = form;
  const criteria = useFieldArray({ control, name: 'criteria' });
  const prizes = useFieldArray({ control, name: 'prizes' });
  const resources = useFieldArray({ control, name: 'resources' });
  const teamEnabled = watch('team.enabled');
  const visibility = watch('visibility');
  const coverColor = watch('coverColor');
  const tieBreakMode = watch('tieBreakMode');
  // Les identifiants de critères n'existent qu'une fois le hackathon enregistré.
  const namedCriteria = (existing?.criteria ?? []).filter((c) => c.id);
  const { data: jury } = useJury(existing?.slug ?? '');
  const [juryText, setJuryText] = useState('');
  const [juryError, setJuryError] = useState<string | null>(null);
  const seedJuryText = (seedJury ?? []).join(', ');
  useEffect(() => {
    if (jury) setJuryText(jury.map((j) => j.pseudo).join(', '));
    else if (seedJuryText) setJuryText(seedJuryText);
  }, [jury, seedJuryText]);

  async function onSubmit(values: FormValues) {
    const payload = { ...toPayload(values), fromRoundId };
    try {
      const { hackathon } = existing
        ? await update.mutateAsync(payload)
        : await create.mutateAsync(payload);
      const pseudos = juryText
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const currentJury = (jury ?? []).map((j) => j.pseudo).join(',');
      if (pseudos.join(',') !== currentJury) {
        try {
          await evaluationsApi.setJury(hackathon.slug, pseudos);
        } catch (err) {
          setJuryError(err instanceof ApiError ? err.message : 'Jury non enregistré');
          toast.error('Hackathon enregistré, mais le jury n’a pas pu être mis à jour');
          return;
        }
      }
      toast.success(
        existing ? 'Hackathon mis à jour' : `Hackathon #${hackathon.code} créé (brouillon)`,
      );
      navigate('/admin');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
        for (const d of err.details ?? []) {
          setError(d.path as FieldPath<FormValues>, { message: d.message });
        }
      } else {
        toast.error('Enregistrement impossible');
      }
    }
  }

  const err = (path: string): string | undefined => {
    const parts = path.split('.');
    let node: unknown = errors;
    for (const part of parts) {
      if (!node || typeof node !== 'object') return undefined;
      node = (node as Record<string, unknown>)[part];
    }
    return node && typeof node === 'object' && 'message' in node
      ? String((node as { message?: string }).message ?? '')
      : undefined;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex max-w-4xl flex-col gap-10">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {existing
            ? `Modifier #${existing.code} — ${existing.title}`
            : duplicatedFrom
              ? 'Dupliquer une édition'
              : 'Nouveau hackathon'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {existing
            ? 'Le numéro, le slug et le dossier de stockage ne changent pas.'
            : fromRoundId
              ? 'Pré-rempli avec la proposition gagnante du vote. Complète les dates et publie.'
              : duplicatedFrom
                ? `Réglages repris de ${duplicatedFrom} : critères, prix, format et règlement. Les dates sont à redéfinir.`
                : 'Créé en brouillon : personne ne le voit tant que tu ne le publies pas depuis le dashboard.'}
        </p>
      </div>

      <Section title="Identité" hint="Ce que les participants voient en premier.">
        <Field label="Titre" htmlFor={`${id}-title`} error={err('title')} className="sm:col-span-2">
          <Input id={`${id}-title`} {...register('title')} placeholder="Ville durable" />
        </Field>
        <Field label="Thème" htmlFor={`${id}-theme`} error={err('theme')} className="sm:col-span-2">
          <Input
            id={`${id}-theme`}
            {...register('theme')}
            placeholder="Des outils numériques pour une ville plus sobre"
          />
        </Field>
        <Field
          label="Description (markdown)"
          htmlFor={`${id}-desc`}
          error={err('description')}
          className="sm:col-span-2"
        >
          <Textarea id={`${id}-desc`} rows={6} {...register('description')} />
        </Field>
        <Field
          label="Règlement (markdown)"
          htmlFor={`${id}-rules`}
          error={err('rules')}
          className="sm:col-span-2"
        >
          <Textarea id={`${id}-rules`} rows={4} {...register('rules')} />
        </Field>
        <Field
          label="Tags"
          htmlFor={`${id}-tags`}
          hint="Séparés par des virgules"
          error={err('tagsText')}
        >
          <Input id={`${id}-tags`} {...register('tagsText')} placeholder="écologie, open-data" />
        </Field>
        <Field label="Couleur" htmlFor={`${id}-color`} error={err('coverColor')}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={coverColor}
              onChange={(e) =>
                form.setValue('coverColor', e.target.value.toUpperCase(), { shouldValidate: true })
              }
              className="size-10 cursor-pointer rounded-md border bg-card p-1"
              aria-label="Choisir la couleur"
            />
            <Input id={`${id}-color`} {...register('coverColor')} className="font-mono" />
          </div>
        </Field>
      </Section>

      <Section
        title="Format et calendrier"
        hint="Les statuts changent tout seuls aux dates de début et de deadline."
      >
        <Field label="Format" htmlFor={`${id}-format`} error={err('format')}>
          <Select id={`${id}-format`} {...register('format')}>
            {HACKATHON_FORMATS.map((f) => (
              <option key={f} value={f}>
                {HACKATHON_FORMAT_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Lieu / lien" htmlFor={`${id}-location`} error={err('location')}>
          <Input
            id={`${id}-location`}
            {...register('location')}
            placeholder="Salle B — ou lien visio"
          />
        </Field>
        <Field
          label="Ouverture des inscriptions (optionnel)"
          htmlFor={`${id}-reg`}
          error={err('dates.registrationOpensAt')}
        >
          <Input
            id={`${id}-reg`}
            type="datetime-local"
            {...register('dates.registrationOpensAt')}
          />
        </Field>
        <Field label="Début" htmlFor={`${id}-start`} error={err('dates.startsAt')}>
          <Input id={`${id}-start`} type="datetime-local" {...register('dates.startsAt')} />
        </Field>
        <Field
          label="Deadline de dépôt"
          htmlFor={`${id}-deadline`}
          error={err('dates.submissionDeadlineAt')}
        >
          <Input
            id={`${id}-deadline`}
            type="datetime-local"
            {...register('dates.submissionDeadlineAt')}
          />
        </Field>
        <Field label="Fin" htmlFor={`${id}-end`} error={err('dates.endsAt')}>
          <Input id={`${id}-end`} type="datetime-local" {...register('dates.endsAt')} />
        </Field>
        <Field
          label="Résultats (optionnel)"
          htmlFor={`${id}-results`}
          error={err('dates.resultsAt')}
        >
          <Input id={`${id}-results`} type="datetime-local" {...register('dates.resultsAt')} />
        </Field>
        <Field label="Fuseau horaire" htmlFor={`${id}-tz`} error={err('timezone')}>
          <Input id={`${id}-tz`} {...register('timezone')} />
        </Field>
      </Section>

      <Section title="Participation">
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <Checkbox {...register('team.enabled')} /> Participation en équipe
        </label>
        {teamEnabled && (
          <>
            <Field label="Taille min" htmlFor={`${id}-tmin`} error={err('team.minSize')}>
              <Input
                id={`${id}-tmin`}
                type="number"
                min={1}
                {...register('team.minSize', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Taille max" htmlFor={`${id}-tmax`} error={err('team.maxSize')}>
              <Input
                id={`${id}-tmax`}
                type="number"
                min={1}
                {...register('team.maxSize', { valueAsNumber: true })}
              />
            </Field>
          </>
        )}
        <Field
          label="Participants max"
          htmlFor={`${id}-max`}
          hint="Vide = illimité"
          error={err('maxParticipantsText')}
        >
          <Input id={`${id}-max`} type="number" min={1} {...register('maxParticipantsText')} />
        </Field>
        <Field label="Visibilité" htmlFor={`${id}-vis`} error={err('visibility')}>
          <Select id={`${id}-vis`} {...register('visibility')}>
            <option value="public">Public</option>
            <option value="private">Privé (code d’accès)</option>
          </Select>
        </Field>
        {visibility === 'private' && (
          <Field label="Code d’accès" htmlFor={`${id}-code`} error={err('accessCode')}>
            <Input id={`${id}-code`} {...register('accessCode')} autoComplete="off" />
          </Field>
        )}
      </Section>

      <Section title="Dépôt des projets">
        <div className="flex flex-col gap-2 text-sm sm:col-span-2">
          <p className="text-sm font-medium">Formats acceptés</p>
          <label className="flex items-center gap-2.5">
            <Checkbox {...register('submission.zip')} /> Archive zip
          </label>
          <label className="flex items-center gap-2.5">
            <Checkbox {...register('submission.folder')} /> Dossier (compressé par le navigateur)
          </label>
          {err('submission.folder') && (
            <p className="text-xs text-destructive">{err('submission.folder')}</p>
          )}
        </div>
        <Field label="Taille max (Mo)" htmlFor={`${id}-size`} error={err('submission.maxSizeMb')}>
          <Input
            id={`${id}-size`}
            type="number"
            min={1}
            {...register('submission.maxSizeMb', { valueAsNumber: true })}
          />
        </Field>
        <Field
          label="Nombre de fichiers max"
          htmlFor={`${id}-files`}
          error={err('submission.maxFiles')}
        >
          <Input
            id={`${id}-files`}
            type="number"
            min={1}
            {...register('submission.maxFiles', { valueAsNumber: true })}
          />
        </Field>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox {...register('submission.allowResubmit')} /> Re-dépôt possible jusqu’à la
          deadline
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox {...register('submission.allowLate')} /> Tolérer les dépôts en retard (marqués «
          late »)
        </label>

        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <Checkbox {...register('submission.rejectSecrets')} /> Refuser un dépôt contenant une clé
          ou un mot de passe (sinon simple avertissement)
        </label>
        <Field
          label="Licence des projets"
          htmlFor={`${id}-license`}
          error={err('submission.license')}
        >
          <Input id={`${id}-license`} {...register('submission.license')} />
        </Field>
      </Section>

      <Section title="Critères d’évaluation" hint="Le poids pondère la note finale.">
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <Checkbox {...register('publicVote')} /> Vote du public activé (chaque participant a un
          coup de cœur, hors son propre projet)
        </label>

        <Field
          label="Départage des ex æquo"
          htmlFor={`${id}-tiebreak`}
          hint="Appliqué quand deux projets obtiennent exactement le même score."
        >
          <Select id={`${id}-tiebreak`} {...register('tieBreakMode')}>
            {TIE_BREAK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {TIE_BREAK_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        {tieBreakMode === 'criterion' && (
          <Field
            label="Critère prioritaire"
            htmlFor={`${id}-tiebreak-criterion`}
            hint={
              namedCriteria.length === 0
                ? 'Disponible après le premier enregistrement : le premier critère sera utilisé.'
                : undefined
            }
          >
            <Select
              id={`${id}-tiebreak-criterion`}
              disabled={namedCriteria.length === 0}
              {...register('tieBreakCriterionId')}
            >
              <option value="">Premier critère de la liste</option>
              {namedCriteria.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex flex-col gap-3 sm:col-span-2">
          {criteria.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_90px_90px_auto]"
            >
              <Field label="Intitulé" error={err(`criteria.${index}.label`)}>
                <Input {...register(`criteria.${index}.label`)} />
              </Field>
              <Field label="Description" error={err(`criteria.${index}.description`)}>
                <Input {...register(`criteria.${index}.description`)} />
              </Field>
              <Field label="Poids" error={err(`criteria.${index}.weight`)}>
                <Input
                  type="number"
                  step="0.5"
                  min={0.5}
                  {...register(`criteria.${index}.weight`, { valueAsNumber: true })}
                />
              </Field>
              <Field label="Note max" error={err(`criteria.${index}.maxScore`)}>
                <Input
                  type="number"
                  min={1}
                  {...register(`criteria.${index}.maxScore`, { valueAsNumber: true })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label="Supprimer"
                onClick={() => criteria.remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => criteria.append({ label: '', description: '', weight: 1, maxScore: 10 })}
          >
            <Plus /> Ajouter un critère
          </Button>
        </div>
      </Section>

      <Section title="Prix" hint="Dans l’ordre du classement.">
        <div className="flex flex-col gap-3 sm:col-span-2">
          {prizes.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[auto_1fr_1fr_auto]"
            >
              <span className="self-end pb-2.5 font-mono text-sm text-muted-foreground">
                #{index + 1}
              </span>
              <Field label="Intitulé" error={err(`prizes.${index}.label`)}>
                <Input {...register(`prizes.${index}.label`)} />
              </Field>
              <Field label="Description" error={err(`prizes.${index}.description`)}>
                <Input {...register(`prizes.${index}.description`)} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label="Supprimer"
                onClick={() => prizes.remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => prizes.append({ label: '', description: '' })}
          >
            <Plus /> Ajouter un prix
          </Button>
        </div>
      </Section>

      <Section
        title="Jury"
        hint="Pseudos des jurés, séparés par des virgules. Ils doivent déjà être entrés sur la plateforme. L’organisateur entré avec un pseudo peut toujours noter."
      >
        <Field
          label="Jurés"
          htmlFor={`${id}-jury`}
          error={juryError ?? undefined}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-jury`}
            value={juryText}
            onChange={(e) => {
              setJuryText(e.target.value);
              setJuryError(null);
            }}
            placeholder="marie_jury, simon"
          />
        </Field>
      </Section>

      <Section title="Ressources" hint="Docs, APIs, jeux de données.">
        <div className="flex flex-col gap-3 sm:col-span-2">
          {resources.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1.5fr_auto]"
            >
              <Field label="Intitulé" error={err(`resources.${index}.label`)}>
                <Input {...register(`resources.${index}.label`)} />
              </Field>
              <Field label="URL" error={err(`resources.${index}.url`)}>
                <Input type="url" {...register(`resources.${index}.url`)} placeholder="https://" />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label="Supprimer"
                onClick={() => resources.remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => resources.append({ label: '', url: '' })}
          >
            <Plus /> Ajouter une ressource
          </Button>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <p className="text-xs text-muted-foreground">
          {Object.keys(errors).length > 0
            ? 'Corrige les champs en rouge.'
            : existing
              ? 'Les modifications sont visibles immédiatement.'
              : 'Créé en brouillon.'}
        </p>
        <div className="flex gap-2">
          <Link to="/admin" className={buttonVariants({ variant: 'ghost' })}>
            Annuler
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            <Save />{' '}
            {isSubmitting ? 'Enregistrement…' : existing ? 'Enregistrer' : 'Créer le hackathon'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}
