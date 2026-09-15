import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { HackathonWithCounts } from '@hackametz/shared';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useJoinHackathon } from '@/hooks/useParticipation';

interface Props {
  hackathon: HackathonWithCounts;
  open: boolean;
  onClose: () => void;
}

/** Inscription : acceptation du règlement (+ code d'accès pour un hackathon privé). */
export function JoinDialog({ hackathon, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [accepted, setAccepted] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const join = useJoinHackathon(hackathon.slug);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) {
      setError('Tu dois accepter le règlement pour participer');
      return;
    }
    setError(null);
    try {
      await join.mutateAsync({ acceptRules: true, accessCode: accessCode || undefined });
      toast.success(`Tu participes à « ${hackathon.title} » !`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue, réessaie.');
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(92vw,28rem)] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Rejoindre « {hackathon.title} »
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hackathon.team.enabled
                ? `Équipes de ${hackathon.team.minSize} à ${hackathon.team.maxSize} personnes.`
                : 'Participation individuelle.'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>

        {hackathon.rules && (
          <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">
            {hackathon.rules}
          </div>
        )}

        {hackathon.visibility === 'private' && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-code`}>Code d’accès</Label>
            <Input
              id={`${id}-code`}
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Fourni par l’organisateur"
              autoComplete="off"
            />
          </div>
        )}

        <label htmlFor={`${id}-rules`} className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox
            id={`${id}-rules`}
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);
              if (error) setError(null);
            }}
            className="mt-0.5"
          />
          <span>
            J’accepte le règlement et je sais que mon projet, une fois déposé, rejoindra la base de
            connaissance sous licence {hackathon.submission.license}.
          </span>
        </label>
        {error && <p className="-mt-2 text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={join.isPending} className="w-full">
          <UserPlus /> {join.isPending ? 'Inscription…' : 'Je participe'}
        </Button>
      </form>
    </dialog>
  );
}
