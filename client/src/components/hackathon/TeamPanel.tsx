import { useId, useState, type FormEvent } from 'react';
import type { HackathonWithCounts } from '@hackametz/shared';
import { Check, Copy, Crown, LogOut, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/api/client';
import { Avatar } from '@/components/session/Avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSession } from '@/hooks/useSession';
import { useCreateTeam, useJoinTeam, useLeaveTeam, useMyTeam, useTeams } from '@/hooks/useTeams';
import { cn } from '@/lib/utils';

interface Props {
  hackathon: HackathonWithCounts;
  registered: boolean;
}

/** Onglet équipes : mon équipe (créer / rejoindre / code / quitter) puis toutes les équipes. */
export function TeamPanel({ hackathon: h, registered }: Props) {
  const { data: teams } = useTeams(h.slug);
  const { user } = useSession();
  const { data: mine } = useMyTeam(h.slug);
  const create = useCreateTeam(h.slug);
  const join = useJoinTeam(h.slug);
  const leave = useLeaveTeam(h.slug);
  const id = useId();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const canForm = registered && (h.status === 'published' || h.status === 'running');

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      setName('');
      setCode('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    void run(() => create.mutateAsync(name), `Équipe « ${name.trim()} » créée`);
  }

  function onJoin(e: FormEvent) {
    e.preventDefault();
    void run(() => join.mutateAsync(code), 'Bienvenue dans l’équipe !');
  }

  async function copyCode() {
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(mine.inviteCode);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        {mine ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4" /> Mon équipe : {mine.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2">
                {mine.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <Avatar user={m} className="size-7 text-[10px]" />
                    <span className="font-medium">{m.pseudo}</span>
                    {m.id === mine.leaderId && (
                      <Crown
                        className="size-3.5 text-[color:var(--brand-3)]"
                        aria-label="Chef d’équipe"
                      />
                    )}
                    {m.id === user?.id && (
                      <span className="text-xs text-muted-foreground">(toi)</span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {mine.members.length} / {h.team.maxSize} membres
                {mine.members.length < h.team.minSize &&
                  ` — il en faut au moins ${h.team.minSize} pour déposer`}
              </p>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Code d’invitation
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-[0.2em]">
                    {mine.inviteCode}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    aria-label="Copier le code"
                  >
                    {copied ? <Check className="text-success" /> : <Copy />}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  À donner à tes coéquipiers : ils le saisissent dans « Rejoindre une équipe ».
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="self-start"
                disabled={leave.isPending}
                onClick={() => run(() => leave.mutateAsync(), 'Tu as quitté l’équipe')}
              >
                <LogOut /> Quitter l’équipe
              </Button>
            </CardContent>
          </Card>
        ) : canForm ? (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Créer une équipe</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={onCreate} className="flex flex-col gap-3">
                  <Field label="Nom de l’équipe" htmlFor={`${id}-name`}>
                    <Input
                      id={`${id}-name`}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={40}
                      placeholder="Les Mirabelles"
                    />
                  </Field>
                  <Button
                    type="submit"
                    disabled={name.trim().length < 2 || create.isPending}
                    className="self-start"
                  >
                    <Plus /> Créer
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rejoindre une équipe</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={onJoin} className="flex flex-col gap-3">
                  <Field
                    label="Code d’invitation"
                    htmlFor={`${id}-code`}
                    hint="6 caractères, donné par le créateur de l’équipe"
                  >
                    <Input
                      id={`${id}-code`}
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono uppercase tracking-[0.2em]"
                      placeholder="ABC123"
                      autoComplete="off"
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={code.trim().length < 4 || join.isPending}
                    className="self-start"
                  >
                    Rejoindre
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {registered
              ? 'Les équipes sont figées pour ce hackathon.'
              : 'Inscris-toi au hackathon pour créer ou rejoindre une équipe.'}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Équipes ({teams?.length ?? 0})
        </h3>
        {teams && teams.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <li
                key={t.id}
                className={cn(
                  'rounded-xl border bg-card p-4',
                  mine?.id === t.id && 'ring-2 ring-primary/40',
                )}
              >
                <p className="font-medium">{t.name}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {t.members.map((m) => (
                    <li
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs"
                    >
                      <Avatar user={m} className="size-4 text-[8px]" /> {m.pseudo}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.members.length} / {h.team.maxSize}
                  {t.members.length < h.team.maxSize ? ' · cherche des membres' : ' · complète'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucune équipe pour l’instant.
          </p>
        )}
      </div>
    </div>
  );
}
