import { useState } from 'react';
import type { DiscordInfo, TeamDiscord } from '@hackametz/shared';
import { Check, Copy, ExternalLink, Hash, MessageCircle, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';

interface Props {
  discord: DiscordInfo;
  /** Code d'équipe : sans lui, on n'a que le lien vers le serveur. */
  inviteCode?: string;
  /** Salons de l'équipe, une fois créés par le pont. */
  team?: TeamDiscord | null;
}

/**
 * Le pas-à-pas vers les salons Discord de l'équipe : entrer sur le serveur, taper
 * `/rejoindre` avec le code, et les deux salons privés s'ouvrent. La commande est copiable
 * telle quelle : c'est exactement ce que le participant colle dans Discord.
 */
export function DiscordCard({ discord, inviteCode, team }: Props) {
  const [copied, setCopied] = useState(false);
  const command = inviteCode ? `/rejoindre ${inviteCode}` : null;

  async function copyCommand() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(command);
    }
  }

  return (
    <div className="rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/10 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <MessageCircle className="size-3.5" /> Discord de l’équipe
      </p>

      {team ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={team.textChannelUrl}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: 'sm', variant: 'outline' })}
          >
            <Hash /> Salon texte <ExternalLink className="size-3 opacity-60" />
          </a>
          {team.voiceChannelUrl && (
            <a
              href={team.voiceChannelUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <Volume2 /> Vocal <ExternalLink className="size-3 opacity-60" />
            </a>
          )}
        </div>
      ) : null}

      <ol className="mt-2 flex flex-col gap-1.5 text-sm">
        {discord.inviteUrl && (
          <li>
            1.{' '}
            <a
              href={discord.inviteUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Rejoins le serveur Discord
            </a>
          </li>
        )}
        {command && (
          <li className="flex flex-wrap items-center gap-2">
            <span>{discord.inviteUrl ? '2.' : '1.'} Dans #accueil, tape</span>
            <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-sm">
              {command}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={copyCommand}
              aria-label="Copier la commande"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </li>
        )}
        <li className="text-muted-foreground">
          {command ? (discord.inviteUrl ? '3.' : '2.') : '·'} Tes salons texte et vocal s’ouvrent,
          visibles par ton équipe seulement.
        </li>
      </ol>
    </div>
  );
}
