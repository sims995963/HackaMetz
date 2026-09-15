import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { PSEUDO_MAX_LENGTH, pseudoSchema } from '@hackametz/shared';
import { LogIn, X } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth.api';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSessionStore } from '@/store/session.store';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Entrée par pseudo : pas de mot de passe, le serveur lie le pseudo à cet appareil. */
export function PseudoDialog({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = pseudoSchema.safeParse(pseudo);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Pseudo invalide');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { user, token, created } = await authApi.enter(parsed.data);
      setSession(user, token);
      toast.success(created ? `Bienvenue, ${user.pseudo} !` : `Bon retour, ${user.pseudo} !`);
      setPseudo('');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue, réessaie.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[min(92vw,26rem)] rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Entrer avec un pseudo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pas de mot de passe : ton pseudo est lié à cet appareil.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X />
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={inputId}>Pseudo</Label>
          <Input
            id={inputId}
            name="pseudo"
            autoFocus
            autoComplete="username"
            maxLength={PSEUDO_MAX_LENGTH}
            placeholder="ex. simon_dev"
            value={pseudo}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => {
              setPseudo(e.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id={`${inputId}-error`} className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              3 à 20 caractères : lettres, chiffres, _ et -
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting || pseudo.trim().length === 0}
          className="w-full"
        >
          <LogIn />
          {submitting ? 'Connexion…' : 'Entrer'}
        </Button>
      </form>
    </dialog>
  );
}
