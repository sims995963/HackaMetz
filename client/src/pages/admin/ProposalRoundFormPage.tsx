import { useId } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { PROPOSALS_PER_ROUND, type ProposalRoundView } from '@hackametz/shared';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useProposalAdmin, useProposalRound } from '@/hooks/useProposals';

const COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#EA580C', '#16A34A', '#0F766E'];

const proposalForm = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(120),
  theme: z.string().trim().min(3, 'Au moins 3 caractères').max(200),
  description: z.string().max(5000),
  tagsText: z.string(),
  coverColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale'),
});

const formSchema = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(120),
  description: z.string().max(5000),
  proposals: z.array(proposalForm).length(PROPOSALS_PER_ROUND),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = {
  title: '',
  description: '',
  proposals: Array.from({ length: PROPOSALS_PER_ROUND }, (_, i) => ({
    title: '',
    theme: '',
    description: '',
    tagsText: '',
    coverColor: COLORS[i] ?? '#2563EB',
  })),
};

function fromRound(r: ProposalRoundView): FormValues {
  return {
    title: r.title,
    description: r.description,
    proposals: r.proposals.map((p) => ({
      title: p.title,
      theme: p.theme,
      description: p.description,
      tagsText: p.tags.join(', '),
      coverColor: p.coverColor,
    })),
  };
}

export function ProposalRoundFormPage() {
  const { id } = useParams();
  const { data: existing } = useProposalRound(id ?? '');
  if (id && !existing)
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
  return <RoundForm key={existing?.id ?? 'new'} existing={existing} />;
}

function RoundForm({ existing }: { existing: ProposalRoundView | undefined }) {
  const navigate = useNavigate();
  const formId = useId();
  const { create, update } = useProposalAdmin();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: existing ? fromRound(existing) : EMPTY,
  });

  async function onSubmit(values: FormValues) {
    const input = {
      title: values.title,
      description: values.description,
      proposals: values.proposals.map((p) => ({
        title: p.title,
        theme: p.theme,
        description: p.description,
        tags: p.tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        coverColor: p.coverColor,
      })),
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, input });
      else await create.mutateAsync(input);
      toast.success(
        existing ? 'Tour mis à jour' : 'Tour créé en brouillon — ouvre le vote quand tu veux',
      );
      navigate('/propositions');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex max-w-4xl flex-col gap-10">
      <div>
        <Link
          to="/propositions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Propositions
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          {existing ? `Modifier « ${existing.title} »` : 'Nouveau tour de propositions'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trois idées de hackathon. Le tour est créé en brouillon ; les participants votent une fois
          que tu l’ouvres.
        </p>
      </div>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Titre du tour"
          htmlFor={`${formId}-title`}
          error={errors.title?.message}
          className="sm:col-span-2"
        >
          <Input
            id={`${formId}-title`}
            {...register('title')}
            placeholder="Thème de l’hiver 2026"
          />
        </Field>
        <Field
          label="Contexte pour les votants (markdown, optionnel)"
          htmlFor={`${formId}-desc`}
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id={`${formId}-desc`}
            rows={3}
            {...register('description')}
            placeholder="Période visée, contraintes, lieu…"
          />
        </Field>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {EMPTY.proposals.map((_, i) => {
          const color = watch(`proposals.${i}.coverColor`);
          const e = errors.proposals?.[i];
          return (
            <div
              key={i}
              className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
            >
              <div className="h-1.5" style={{ background: color }} aria-hidden />
              <div className="flex flex-col gap-4 px-5 pb-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-bold text-muted-foreground/40">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Couleur ${c}`}
                        onClick={() =>
                          setValue(`proposals.${i}.coverColor`, c, { shouldDirty: true })
                        }
                        className="size-5 rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-primary"
                        aria-pressed={color === c}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <Field label="Titre" htmlFor={`${formId}-p${i}-title`} error={e?.title?.message}>
                  <Input
                    id={`${formId}-p${i}-title`}
                    {...register(`proposals.${i}.title`)}
                    placeholder="Nuit du code créatif"
                  />
                </Field>
                <Field label="Thème" htmlFor={`${formId}-p${i}-theme`} error={e?.theme?.message}>
                  <Input
                    id={`${formId}-p${i}-theme`}
                    {...register(`proposals.${i}.theme`)}
                    placeholder="En une phrase"
                  />
                </Field>
                <Field
                  label="Description (optionnel)"
                  htmlFor={`${formId}-p${i}-desc`}
                  error={e?.description?.message}
                >
                  <Textarea
                    id={`${formId}-p${i}-desc`}
                    rows={3}
                    {...register(`proposals.${i}.description`)}
                  />
                </Field>
                <Field
                  label="Tags"
                  htmlFor={`${formId}-p${i}-tags`}
                  hint="Séparés par des virgules"
                  error={e?.tagsText?.message}
                >
                  <Input
                    id={`${formId}-p${i}-tags`}
                    {...register(`proposals.${i}.tagsText`)}
                    placeholder="créatif, webgl"
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <p className="text-xs text-muted-foreground">
          {Object.keys(errors).length > 0
            ? 'Corrige les champs en rouge.'
            : 'Trois propositions, pas une de plus.'}
        </p>
        <div className="flex gap-2">
          <Link to="/propositions" className={buttonVariants({ variant: 'ghost' })}>
            Annuler
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            <Save /> {existing ? 'Enregistrer' : 'Créer le tour'}
          </Button>
        </div>
      </div>
    </form>
  );
}
