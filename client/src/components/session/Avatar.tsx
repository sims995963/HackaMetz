import type { User } from '@hackametz/shared';
import { avatarColor, initials } from '@/lib/avatar';
import { cn } from '@/lib/utils';

export function Avatar({
  user,
  className,
}: {
  user: Pick<User, 'pseudo' | 'avatarSeed'>;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{ background: avatarColor(user.avatarSeed) }}
      aria-hidden
    >
      {initials(user.pseudo)}
    </span>
  );
}
