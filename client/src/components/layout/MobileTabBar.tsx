import { FolderArchive, Home, Lightbulb, LogIn, Trophy, User } from 'lucide-react';
import { NavLink } from 'react-router';
import { useProposalRounds } from '@/hooks/useProposals';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';

interface Props {
  onEnter: () => void;
}

const TABS = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/hackathons', label: 'Éditions', icon: Trophy, end: false },
  { to: '/propositions', label: 'Votes', icon: Lightbulb, end: false },
  { to: '/kb', label: 'Projets', icon: FolderArchive, end: false },
];

/**
 * Barre d'onglets en bas d'écran sur mobile : les quatre destinations principales
 * restent sous le pouce pendant l'événement. Le menu latéral garde le reste.
 */
export function MobileTabBar({ onEnter }: Props) {
  const { isLoggedIn } = useSession();
  const { data: rounds } = useProposalRounds();
  const voteOpen = rounds?.some((r) => r.status === 'open') ?? false;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl print:hidden lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand"
                      aria-hidden
                    />
                  )}
                  <span className="relative">
                    <Icon className={cn('size-5', isActive && 'stroke-[2.25]')} />
                    {to === '/propositions' && voteOpen && (
                      <span
                        className="absolute -right-1 -top-0.5 size-2 animate-pulse rounded-full bg-brand-2 ring-2 ring-background"
                        aria-label="Vote ouvert"
                      />
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          {isLoggedIn ? (
            <NavLink
              to="/me"
              className={({ isActive }) =>
                cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand"
                      aria-hidden
                    />
                  )}
                  <User className={cn('size-5', isActive && 'stroke-[2.25]')} />
                  Profil
                </>
              )}
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={onEnter}
              className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogIn className="size-5" />
              Entrer
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}
