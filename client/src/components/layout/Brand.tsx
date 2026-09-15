import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/** Logo + nom. Mène par défaut à l'accueil ; la barre latérale l'envoie vers la page de marque. */
export function Brand({
  className,
  to = '/',
  onClick,
}: {
  className?: string;
  to?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn('group flex items-center gap-2.5 font-semibold tracking-tight', className)}
    >
      <span className="relative inline-flex size-8 items-center justify-center rounded-[10px] bg-brand font-display text-[15px] font-bold text-white shadow-soft transition-transform group-hover:scale-105">
        H
      </span>
      <span className="font-display text-[17px]">
        Hacka<span className="text-brand">Metz</span>
      </span>
    </Link>
  );
}
