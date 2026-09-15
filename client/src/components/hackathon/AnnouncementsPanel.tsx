import { useId, useState, type FormEvent } from 'react';
import { Megaphone, Pin, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useRemoveAnnouncement,
} from '@/hooks/useAnnouncements';
import { useSession } from '@/hooks/useSession';
import { fromNow } from '@/lib/dates';
import { Markdown } from '@/components/markdown/Markdown';

/** Annonces de l'organisateur ; le formulaire n'apparaît qu'avec la clé admin. */
export function AnnouncementsPanel({ slug }: { slug: string }) {
  const { isAdmin } = useSession();
  const { data: announcements } = useAnnouncements(slug);
  const create = useCreateAnnouncement(slug);
  const remove = useRemoveAnnouncement(slug);
  const id = useId();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ title, content, pinned });
      toast.success('Annonce publiée — les participants connectés la voient tout de suite');
      setTitle('');
      setContent('');
      setPinned(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Publication impossible');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-3">
        {announcements && announcements.length > 0 ? (
          announcements.map((a) => (
            <article key={a.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {a.pinned ? (
                    <Pin className="size-4 text-[color:var(--brand-3)]" aria-label="Épinglée" />
                  ) : (
                    <Megaphone className="size-4 text-muted-foreground" />
                  )}
                  <h3 className="font-semibold">{a.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{fromNow(a.createdAt)}</span>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutateAsync(a.id).catch(() => toast.error('Suppression impossible'))
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              {a.content && (
                <div className="mt-2">
                  <Markdown>{a.content}</Markdown>
                </div>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aucune annonce pour l’instant. Elles arrivent ici en direct.
          </p>
        )}
      </div>

      {isAdmin && (
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4" /> Publier une annonce
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field label="Titre" htmlFor={`${id}-title`}>
                <Input
                  id={`${id}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Pizza à 20 h, salle B"
                />
              </Field>
              <Field label="Contenu (markdown, optionnel)" htmlFor={`${id}-content`}>
                <Textarea
                  id={`${id}-content`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={5000}
                  rows={4}
                />
              </Field>
              <label htmlFor={`${id}-pinned`} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`${id}-pinned`}
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />{' '}
                Épingler en haut
              </label>
              <Button
                type="submit"
                disabled={title.trim().length === 0 || create.isPending}
                className="self-start"
              >
                <Send /> Publier
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
