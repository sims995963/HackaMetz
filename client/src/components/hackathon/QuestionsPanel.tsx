import { useState, type FormEvent } from 'react';
import type { QuestionView } from '@hackametz/shared';
import { ChevronUp, CornerDownRight, MessageCircleQuestion, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Markdown } from '@/components/markdown/Markdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  useAnswerQuestion,
  useAskQuestion,
  useQuestions,
  useRemoveQuestion,
  useUpvoteQuestion,
} from '@/hooks/useQuestions';
import { useSession } from '@/hooks/useSession';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

interface Props {
  slug: string;
  /** Un hackathon archivé n'accepte plus de questions. */
  closed: boolean;
  onEnter: () => void;
}

/** Questions des participants à l'organisateur : +1 pour faire remonter, réponse en ligne. */
export function QuestionsPanel({ slug, closed, onEnter }: Props) {
  const { isLoggedIn, isAdmin } = useSession();
  const { data: questions, isPending } = useQuestions(slug);
  const ask = useAskQuestion(slug);
  const [content, setContent] = useState('');

  const open = questions?.filter((q) => !q.answer) ?? [];
  const answered = questions?.filter((q) => q.answer) ?? [];

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    try {
      await ask.mutateAsync({ content });
      setContent('');
      toast.success('Question envoyée — l’organisateur est prévenu');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Envoi impossible');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-8">
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            En attente <span className="font-mono text-xs">{open.length}</span>
          </h3>
          {isPending ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted/60" />
          ) : open.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {open.map((q) => (
                <QuestionCard key={q.id} slug={slug} question={q} />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Aucune question en attente.
            </p>
          )}
        </section>

        {answered.length > 0 && (
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Répondues <span className="font-mono text-xs">{answered.length}</span>
            </h3>
            <ul className="flex flex-col gap-3">
              {answered.map((q) => (
                <QuestionCard key={q.id} slug={slug} question={q} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="self-start rounded-2xl border border-border/70 bg-card p-6 shadow-soft">
        <h3 className="flex items-center gap-2 font-semibold">
          <MessageCircleQuestion className="size-4 text-brand-1" /> Poser une question
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Règlement, matériel, horaires… L’organisateur répond ici, à la vue de tous. Un{' '}
          <ChevronUp className="inline size-3.5" /> fait remonter les questions qui comptent.
        </p>
        {closed ? (
          <p className="mt-4 text-sm text-muted-foreground">Cette édition est archivée.</p>
        ) : !isLoggedIn ? (
          <Button className="mt-4 w-full" variant="secondary" onClick={onEnter}>
            Entrer avec un pseudo pour demander
          </Button>
        ) : (
          <form onSubmit={onAsk} className="mt-4 flex flex-col gap-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Peut-on utiliser une API externe ?"
              maxLength={1000}
              rows={4}
              aria-label="Ta question"
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted-foreground">
                {content.length}/1000
              </span>
              <Button type="submit" disabled={content.trim().length < 5 || ask.isPending}>
                <Send /> Envoyer
              </Button>
            </div>
          </form>
        )}
        {isAdmin && (
          <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
            Tu es organisateur : réponds directement sous chaque question.
          </p>
        )}
      </aside>
    </div>
  );
}

function QuestionCard({ slug, question: q }: { slug: string; question: QuestionView }) {
  const { isLoggedIn, isAdmin } = useSession();
  const upvote = useUpvoteQuestion(slug);
  const remove = useRemoveQuestion(slug);
  const answer = useAnswerQuestion(slug);
  const [draft, setDraft] = useState('');
  const [replying, setReplying] = useState(false);
  const canRemove = isAdmin || (q.mine && !q.answer);

  async function onAnswer(e: FormEvent) {
    e.preventDefault();
    try {
      await answer.mutateAsync({ id: q.id, content: draft });
      setDraft('');
      setReplying(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Réponse impossible');
    }
  }

  return (
    <li className="flex gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
      <button
        type="button"
        disabled={!isLoggedIn || upvote.isPending}
        onClick={() => upvote.mutate({ id: q.id, upvoted: !q.upvoted })}
        aria-pressed={q.upvoted}
        aria-label={q.upvoted ? 'Retirer mon +1' : 'Soutenir cette question'}
        title={isLoggedIn ? undefined : 'Entre avec un pseudo pour soutenir'}
        className={cn(
          'flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition-colors',
          q.upvoted
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/70 bg-background text-muted-foreground hover:border-border hover:text-foreground',
          !isLoggedIn && 'cursor-default opacity-70',
        )}
      >
        <ChevronUp className="size-4" />
        <span className="font-mono text-xs">{q.upvotes}</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line text-sm leading-relaxed">{q.content}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{q.authorPseudo}</span>
          <span>·</span>
          <span>{fromNow(q.createdAt)}</span>
          {canRemove && (
            <button
              type="button"
              onClick={() =>
                remove.mutateAsync(q.id).catch(() => toast.error('Suppression impossible'))
              }
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" /> Retirer
            </button>
          )}
        </p>

        {q.answer ? (
          <div className="mt-3 flex gap-2 rounded-xl border-l-2 border-l-[color:var(--brand-1)] bg-muted/50 px-4 py-3">
            <CornerDownRight className="mt-0.5 size-4 shrink-0 text-brand-1" />
            <div className="min-w-0 text-sm">
              <Markdown>{q.answer.content}</Markdown>
              <p className="mt-1 text-xs text-muted-foreground">
                {q.answer.byPseudo} · {fromNow(q.answer.at)}
              </p>
            </div>
          </div>
        ) : isAdmin && replying ? (
          <form onSubmit={onAnswer} className="mt-3 flex flex-col gap-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Ta réponse (markdown accepté)"
              aria-label="Réponse"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setReplying(false)}>
                Annuler
              </Button>
              <Button size="sm" type="submit" disabled={!draft.trim() || answer.isPending}>
                <Send /> Répondre
              </Button>
            </div>
          </form>
        ) : isAdmin ? (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setReplying(true)}>
            <CornerDownRight /> Répondre
          </Button>
        ) : null}
      </div>
    </li>
  );
}
