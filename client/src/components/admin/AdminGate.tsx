import { useId, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { statsApi } from '@/api/stats.api';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSessionStore } from '@/store/session.store';

/**
 * Protège l'espace organisateur : la clé (ADMIN_KEY du .env) est saisie une fois,
 * vérifiée contre l'API, puis envoyée dans chaque requête.
 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const adminKey = useSessionStore((s) => s.adminKey);
  const setAdminKey = useSessionStore((s) => s.setAdminKey);
  const queryClient = useQueryClient();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (adminKey) return <>{children}</>;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(null);
    setAdminKey(value.trim());
    try {
      await statsApi.admin();
      void queryClient.invalidateQueries();
      toast.success('Espace organisateur déverrouillé');
    } catch (err) {
      setAdminKey(null);
      setError(
        err instanceof ApiError && err.status === 403
          ? 'Clé invalide. C’est la valeur ADMIN_KEY du fichier .env du serveur.'
          : err instanceof ApiError
            ? err.message
            : 'Impossible de vérifier la clé',
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-2xl border bg-card p-8">
        <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand text-white">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Espace organisateur</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisis la clé d’organisateur pour créer et piloter les hackathons. Elle reste sur cet
          appareil.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Field label="Clé d’organisateur" htmlFor={`${id}-key`} error={error ?? undefined}>
            <Input
              id={`${id}-key`}
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ADMIN_KEY"
              autoFocus
            />
          </Field>
          <Button type="submit" disabled={checking || value.trim().length < 8}>
            <KeyRound /> {checking ? 'Vérification…' : 'Déverrouiller'}
          </Button>
        </form>
      </div>
    </div>
  );
}
