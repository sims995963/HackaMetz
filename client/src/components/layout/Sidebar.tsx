import {
  ChevronsUpDown,
  FolderArchive,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  LogOut,
  Moon,
  Search,
  Smartphone,
  Sun,
  Trophy,
  User,
} from 'lucide-react';
import { Link, NavLink } from 'react-router';
import { toast } from 'sonner';
import { Brand } from '@/components/layout/Brand';
import { Avatar } from '@/components/session/Avatar';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem, MenuLabel, MenuLink, MenuSeparator } from '@/components/ui/menu';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useProposalRounds } from '@/hooks/useProposals';
import { useSession } from '@/hooks/useSession';
import { resolveTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  /** Pastille à droite (ex. « vote ouvert »). */
  badge?: string;
}

const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/hackathons', label: 'Hackathons', icon: Trophy },
  { to: '/propositions', label: 'Propositions', icon: Lightbulb },
  { to: '/kb', label: 'Base de connaissance', icon: FolderArchive },
];

const ROLE_LABELS = { admin: 'Organisateur', jury: 'Jury', participant: 'Participant' } as const;

export interface SidebarProps {
  onNavigate?: () => void;
  onEnter: () => void;
  /** Ouvre la palette de commandes (⌘K). */
  onSearch: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-5 flex items-center px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 first:mt-1">
      {children}
    </p>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-px">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground',
                isActive && 'bg-accent text-accent-foreground hover:bg-accent',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                    aria-hidden
                  />
                )}
                <Icon
                  className={cn(
                    'size-[18px] shrink-0 stroke-[1.75] transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground/80 group-hover:text-foreground',
                  )}
                />
                <span className="truncate">{label}</span>
                {badge && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-2/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-brand-2" />
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** Déclencheur de la palette de commandes : même allure qu'un champ, mais ça ouvre ⌘K. */
function SidebarSearch({ onSearch }: { onSearch: () => void }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={onSearch}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-transparent bg-muted/60 px-2.5 text-[13.5px] text-muted-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Rechercher…</span>
        <kbd className="ml-auto shrink-0 rounded border border-border/70 bg-card px-1.5 font-mono text-[10px]">
          {mac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>
    </div>
  );
}

function UserCard({
  onNavigate,
  theme,
  onToggleTheme,
}: Omit<SidebarProps, 'onEnter' | 'onSearch'>) {
  const { user, logout } = useSession();
  const dark = resolveTheme(theme) === 'dark';
  if (!user) return null;
  return (
    <Menu
      side="top"
      align="start"
      className="w-full"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/70 p-2 text-left transition-all hover:border-border hover:bg-card hover:shadow-soft',
            open && 'border-primary/40 bg-card shadow-soft',
          )}
        >
          <Avatar user={user} className="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{user.pseudo}</span>
            <span className="block text-[11px] text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground/70" />
        </button>
      )}
    >
      <MenuLabel>
        <span className="normal-case tracking-normal">{user.pseudo}</span>
      </MenuLabel>
      <MenuLink to="/me">
        <User /> Mon profil
      </MenuLink>
      <MenuItem onClick={onToggleTheme}>
        {dark ? <Sun /> : <Moon />} {dark ? 'Thème clair' : 'Thème sombre'}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        destructive
        onClick={() => {
          logout();
          onNavigate?.();
          toast('À bientôt !');
        }}
      >
        <LogOut /> Se déconnecter
      </MenuItem>
    </Menu>
  );
}

export function SidebarContent({
  onNavigate,
  onEnter,
  onSearch,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const { isLoggedIn, isAdmin } = useSession();
  const dark = resolveTheme(theme) === 'dark';
  const { data: rounds } = useProposalRounds();
  const { canInstall, install } = useInstallPrompt();
  const voteOpen = rounds?.some((r) => r.status === 'open') ?? false;
  const mainNav = MAIN_NAV.map((item) =>
    item.to === '/propositions' && voteOpen ? { ...item, badge: 'vote' } : item,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Brand to="/hackametz" onClick={onNavigate} />
      </div>

      <SidebarSearch onSearch={onSearch} />

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Navigation principale">
        <SectionLabel>Explorer</SectionLabel>
        <NavLinks items={mainNav} onNavigate={onNavigate} />

        {isLoggedIn && (
          <>
            <SectionLabel>Moi</SectionLabel>
            <NavLinks
              items={[{ to: '/me', label: 'Mon profil', icon: User }]}
              onNavigate={onNavigate}
            />
          </>
        )}

        <SectionLabel>
          Organisation
          {isAdmin && (
            <span className="ml-2 rounded bg-brand px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
              admin
            </span>
          )}
        </SectionLabel>
        <NavLinks
          items={[{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }]}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="shrink-0 p-3">
        {isLoggedIn ? (
          <UserCard onNavigate={onNavigate} theme={theme} onToggleTheme={onToggleTheme} />
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <p className="text-[13.5px] font-semibold">Pas de compte à créer</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Un pseudo suffit pour participer.
            </p>
            <Button size="sm" className="mt-3 w-full" onClick={onEnter}>
              <LogIn /> Entrer avec un pseudo
            </Button>
          </div>
        )}
        {canInstall && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-border/60 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
          >
            <Smartphone className="size-3.5" /> Installer l’app
          </button>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {dark ? 'Thème clair' : 'Thème sombre'}
        </button>
        <Link
          to="/hackametz"
          onClick={onNavigate}
          className="mt-1 block text-center font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          HackaMetz
        </Link>
      </div>
    </div>
  );
}
