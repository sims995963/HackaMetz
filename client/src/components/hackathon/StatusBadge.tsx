import { HACKATHON_STATUS_LABELS, type HackathonStatus } from '@hackametz/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const VARIANTS: Record<HackathonStatus, NonNullable<BadgeProps['variant']>> = {
  draft: 'outline',
  published: 'info',
  running: 'success',
  submissions_closed: 'warning',
  judging: 'warning',
  finished: 'secondary',
  archived: 'secondary',
};

export function StatusBadge({
  status,
  className,
}: {
  status: HackathonStatus;
  className?: string;
}) {
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      {status === 'running' && (
        <span className="size-1.5 rounded-full bg-current animate-pulse" aria-hidden />
      )}
      {HACKATHON_STATUS_LABELS[status]}
    </Badge>
  );
}
