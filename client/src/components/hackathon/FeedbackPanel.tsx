import { useEffect, useState, type FormEvent } from 'react';
import { FEEDBACK_MAX_RATING } from '@hackametz/shared';
import { Check, MessageSquareHeart, Star } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useFeedbackSummary, useSendFeedback } from '@/hooks/useFeedback';
import { useSession } from '@/hooks/useSession';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Props {
  slug: string;
  registered: boolean;
}

const RATING_LABELS = ['', 'Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'];

/**
 * Retours des participants une fois les dépôts clos : chacun note l'édition,
 * l'organisateur voit la synthèse et les commentaires anonymisés.
 */
export function FeedbackPanel({ slug, registered }: Props) {
  const { isAdmin } = useSession();
  const { data } = useFeedbackSummary(slug);
  if (!data) return null;
  const canAnswer = registered && data.open;
  if (!canAnswer && !isAdmin && data.count === 0) return null;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <MessageSquareHeart className="size-4 text-brand-2" /> Retours sur l’édition
      </h2>
      <div className="mt-4 flex flex-col gap-6">
        <Summary
          count={data.count}
          participants={data.participants}
          average={data.averageRating}
          distribution={data.distribution}
          wouldReturnRate={data.wouldReturnRate}
        />
        {canAnswer && <FeedbackForm slug={slug} mine={data.mine} />}
        {isAdmin && data.comments.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.comments.map((c, i) => (
              <li key={i} className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Stars value={c.rating} size="sm" />
                  <span>{c.wouldReturn ? 'reviendrait' : 'ne reviendrait pas'}</span>
                  <span>· {fromNow(c.at)}</span>
                </p>
                {c.liked && (
                  <p className="mt-1.5">
                    <span className="font-medium text-brand-1">+</span> {c.liked}
                  </p>
                )}
                {c.improve && (
                  <p className="mt-1">
                    <span className="font-medium text-brand-3">→</span> {c.improve}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Summary({
  count,
  participants,
  average,
  distribution,
  wouldReturnRate,
}: {
  count: number;
  participants: number;
  average: number | null;
  distribution: Record<string, number>;
  wouldReturnRate: number | null;
}) {
  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas encore de retour. Les participants sont invités à noter l’édition dès la fin des dépôts.
      </p>
    );
  }
  const max = Math.max(1, ...Object.values(distribution));
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="flex items-end gap-4">
        <div>
          <p className="font-display text-4xl font-bold leading-none tracking-tight">
            {average?.toFixed(1)}
            <span className="text-base font-medium text-muted-foreground">/5</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {count} avis · {participants > 0 ? Math.round((count / participants) * 100) : 0} % des
            inscrits
          </p>
        </div>
        {wouldReturnRate !== null && (
          <p className="text-xs text-muted-foreground">
            <span className="block font-display text-xl font-semibold text-foreground">
              {wouldReturnRate} %
            </span>
            reviendraient
          </p>
        )}
      </div>
      <ul className="flex flex-col gap-1" aria-label="Répartition des notes">
        {[5, 4, 3, 2, 1].map((n) => (
          <li key={n} className="flex items-center gap-2 text-xs">
            <span className="w-3 font-mono text-muted-foreground">{n}</span>
            <Star className="size-3 fill-current text-brand-3" />
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${((distribution[String(n)] ?? 0) / max) * 100}%` }}
              />
            </span>
            <span className="w-4 text-right font-mono text-muted-foreground">
              {distribution[String(n)] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stars({
  value,
  size = 'md',
  onChange,
}: {
  value: number;
  size?: 'sm' | 'md';
  onChange?: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={onChange ? 'radiogroup' : undefined}
      aria-label={onChange ? 'Note' : `${value} sur 5`}
    >
      {Array.from({ length: FEEDBACK_MAX_RATING }, (_, i) => i + 1).map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} — ${RATING_LABELS[n]}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={cn(
                'size-7 transition-colors',
                n <= shown
                  ? 'fill-[color:var(--brand-3)] text-[color:var(--brand-3)]'
                  : 'text-border',
              )}
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn(
              size === 'sm' ? 'size-3' : 'size-4',
              n <= value
                ? 'fill-[color:var(--brand-3)] text-[color:var(--brand-3)]'
                : 'text-border',
            )}
          />
        ),
      )}
    </span>
  );
}

function FeedbackForm({
  slug,
  mine,
}: {
  slug: string;
  mine: { rating: number; liked: string; improve: string; wouldReturn: boolean } | null;
}) {
  const send = useSendFeedback(slug);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [liked, setLiked] = useState(mine?.liked ?? '');
  const [improve, setImprove] = useState(mine?.improve ?? '');
  const [wouldReturn, setWouldReturn] = useState(mine?.wouldReturn ?? true);
  const [editing, setEditing] = useState(mine === null);

  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setLiked(mine.liked);
      setImprove(mine.improve);
      setWouldReturn(mine.wouldReturn);
    }
  }, [mine]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await send.mutateAsync({ rating, liked, improve, wouldReturn });
      setEditing(false);
      toast.success('Merci pour ton retour !');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Envoi impossible');
    }
  }

  if (mine && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm">
        <p className="inline-flex items-center gap-2">
          <Check className="size-4 text-brand-1" /> Ton avis est enregistré :{' '}
          <Stars value={mine.rating} />
        </p>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Modifier
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background/60 p-4"
    >
      <div>
        <p className="text-sm font-medium">Comment as-tu trouvé cette édition ?</p>
        <div className="mt-2 flex items-center gap-3">
          <Stars value={rating} onChange={setRating} />
          <span className="text-sm text-muted-foreground">{RATING_LABELS[rating]}</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ce qui t’a plu" htmlFor={`${slug}-liked`}>
          <Textarea
            id={`${slug}-liked`}
            value={liked}
            onChange={(e) => setLiked(e.target.value)}
            rows={3}
            maxLength={2000}
            className="min-h-0"
          />
        </Field>
        <Field label="À améliorer" htmlFor={`${slug}-improve`}>
          <Textarea
            id={`${slug}-improve`}
            value={improve}
            onChange={(e) => setImprove(e.target.value)}
            rows={3}
            maxLength={2000}
            className="min-h-0"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={`${slug}-return`} className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${slug}-return`}
            checked={wouldReturn}
            onChange={(e) => setWouldReturn(e.target.checked)}
          />
          Je reviendrais à la prochaine édition
        </label>
        <div className="flex gap-2">
          {mine && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          )}
          <Button type="submit" size="sm" disabled={rating === 0 || send.isPending}>
            {mine ? 'Mettre à jour' : 'Envoyer mon avis'}
          </Button>
        </div>
      </div>
    </form>
  );
}
