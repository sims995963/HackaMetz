import type { Diagnostics } from '@hackametz/shared';
import { Database, HardDrive, MessageCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import { fromNow } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** Seuils au-delà desquels on prévient : pendant un événement, le disque est le premier à lâcher. */
const LOW_DISK_RATIO = 0.1;
const STALE_BACKUP_HOURS = 6;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function ServerHealth({ diagnostics: d }: { diagnostics: Diagnostics }) {
  const freeRatio = d.diskTotalBytes > 0 ? d.diskFreeBytes / d.diskTotalBytes : 1;
  const diskLow = d.diskTotalBytes > 0 && freeRatio < LOW_DISK_RATIO;
  const backupAgeHours = d.lastBackupAt
    ? (Date.now() - new Date(d.lastBackupAt).getTime()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  const backupStale = backupAgeHours > STALE_BACKUP_HOURS;

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <HardDrive className="size-4 text-muted-foreground" /> Santé du serveur
      </h2>

      <dl className="mt-4 flex flex-col divide-y divide-border/60 text-sm">
        <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0">
          <dt className="text-muted-foreground">Projets archivés</dt>
          <dd className="font-mono">
            {formatBytes(d.storageBytes)}
            <span className="text-muted-foreground"> · {d.storageFiles} fichiers</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Database className="size-3.5" /> Base JSON
          </dt>
          <dd className="font-mono">{formatBytes(d.dataBytes)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <dt className={cn('text-muted-foreground', diskLow && 'text-warning')}>Disque libre</dt>
          <dd className={cn('font-mono', diskLow && 'font-semibold text-warning')}>
            {d.diskTotalBytes > 0 ? (
              <>
                {formatBytes(d.diskFreeBytes)}
                <span className="text-muted-foreground"> · {Math.round(freeRatio * 100)} %</span>
              </>
            ) : (
              'inconnu'
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2 last:pb-0">
          <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
            <MessageCircle className="size-3.5" /> Discord
          </dt>
          <dd
            className={cn(
              'text-right',
              d.discord.state === 'error' && 'font-semibold text-warning',
            )}
            title={d.discord.error ?? undefined}
          >
            {d.discord.state === 'disabled' && (
              <span className="text-muted-foreground">non configuré</span>
            )}
            {d.discord.state === 'connecting' && 'connexion…'}
            {d.discord.state === 'connected' && (
              <>
                {d.discord.guildName}
                <span className="text-muted-foreground">
                  {' '}
                  · {d.discord.openSpaces} espace{d.discord.openSpaces > 1 ? 's' : ''}
                </span>
              </>
            )}
            {d.discord.state === 'error' && 'en erreur'}
          </dd>
        </div>
      </dl>

      <p
        className={cn(
          'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
          backupStale ? 'bg-warning/15 text-warning' : 'bg-muted/50 text-muted-foreground',
        )}
      >
        {backupStale ? (
          <TriangleAlert className="size-4 shrink-0" />
        ) : (
          <ShieldCheck className="size-4 shrink-0 text-success" />
        )}
        {d.lastBackupAt ? (
          <>
            Dernière sauvegarde {fromNow(d.lastBackupAt)}
            {backupStale && ' — lance « npm run backup »'}
          </>
        ) : (
          <>
            Aucune sauvegarde trouvée — lance <span className="font-mono">npm run backup</span>{' '}
            avant l’événement
          </>
        )}
      </p>
    </section>
  );
}
