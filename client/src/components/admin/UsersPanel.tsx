import { useState } from 'react';
import { ChevronDown, KeyRound, Search, Smartphone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Avatar } from '@/components/session/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminUsers, useReleaseUser } from '@/hooks/useUsers';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * Pseudos inscrits, et le bouton qui sauve la soirée : libérer un pseudo resté lié
 * à un autre appareil (téléphone à plat, navigateur en navigation privée, PC prêté).
 */
export function UsersPanel({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: users } = useAdminUsers(enabled && open);
  const release = useReleaseUser();

  const needle = query.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => u.pseudo.toLowerCase().includes(needle));

  async function onRelease(id: string, pseudo: string) {
    try {
      await release.mutateAsync(id);
      toast.success(`« ${pseudo} » libéré — il peut entrer depuis un nouvel appareil`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Libération impossible');
    }
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <Users className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">Pseudos</span>
          <span className="block text-sm text-muted-foreground">
            Libérer un pseudo bloqué sur un autre appareil.
          </span>
        </span>
        {users && <span className="font-mono text-xs text-muted-foreground">{users.length}</span>}
        <ChevronDown
          className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border/60 px-5 py-4">
          <div className="relative mb-3 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Chercher un pseudo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Chercher un pseudo"
            />
          </div>

          {!users ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {needle ? 'Aucun pseudo ne correspond.' : 'Personne n’est encore entré.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {shown.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Avatar user={user} className="size-8 text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{user.pseudo}</span>
                    <span className="block text-xs text-muted-foreground">
                      vu {fromNow(user.lastSeenAt)} · {user.registrations} édition
                      {user.registrations > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                    title="Appareils liés à ce pseudo"
                  >
                    <Smartphone className="size-3.5" /> {user.devices}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={user.devices === 0 || release.isPending}
                    onClick={() => void onRelease(user.id, user.pseudo)}
                  >
                    <KeyRound /> Libérer
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Un pseudo est lié aux appareils qui l’ont utilisé. Libérer détache tous ses appareils :
            la personne peut alors entrer depuis un nouveau téléphone, et les sessions ouvertes
            ailleurs s’arrêtent.
          </p>
        </div>
      )}
    </section>
  );
}
