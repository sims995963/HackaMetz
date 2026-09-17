import {
  ChevronsUpDown,
  FolderArchive,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
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
  /** Rail réduit aux icônes. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-3 h-px w-8 bg-border/70" aria-hidden />;
  return (
    <p className="mb-1 mt-5 flex items-center px-4 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground first:mt-1">
      {children}
    </p>
  );
}

function NavLinks({
  items,
  onNavigate,
  collapsed,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <li key={to} className={collapsed ? 'flex justify-center' : undefined}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex h-11 items-center rounded-full text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed ? 'w-11 justify-center' : 'gap-3 px-4',
                isActive && 'bg-accent font-medium text-accent-foreground hover:bg-accent',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon
                    className={cn(
                      'size-[20px] shrink-0 stroke-[1.75] transition-colors',
                      isActive ? 'text-primary' : 'group-hover:text-foreground',
                    )}
                  />
                  {badge && collapsed && (
                    <span
                      className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-brand-2 ring-2 ring-background"
                      aria-label={badge}
                    />
                  )}
                </span>
                {!collapsed && <span className="truncate">{label}</span>}
                {badge && !collapsed && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brand-2/10 px-2 py-0.5 text-[10px] font-medium text-brand-2">
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

/** Déclencheur de la palette de commandes : champ en pilule, ou simple icône quand le rail est réduit. */
function SidebarSearch({ onSearch, collapsed }: { onSearch: () => void; collapsed: boolean }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  if (collapsed) {
    return (
      <div className="flex justify-center px-3 pb-2">
        <button
          type="button"
          onClick={onSearch}
          title="Rechercher"
          aria-label="Rechercher"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-[20px]" />
        </button>
      </div>
    );
  }
  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={onSearch}
        className="flex h-11 w-full items-center gap-3 rounded-full bg-muted/70 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-[18px] shrink-0" />
        <span className="truncate">Rechercher…</span>
        <kbd className="ml-auto shrink-0 rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[10px]">
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
  collapsed,
}: Omit<SidebarProps, 'onEnter' | 'onSearch'> & { collapsed: boolean }) {
  const { user, logout } = useSession();
  const dark = resolveTheme(theme) === 'dark';
  if (!user) return null;
  return (
    <Menu
      side="top"
      align="start"
      className={collapsed ? '' : 'w-full'}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          title={collapsed ? user.pseudo : undefined}
          className={cn(
            'flex items-center rounded-full text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'size-11 justify-center' : 'w-full gap-3 p-2 pr-3',
            open && 'bg-muted',
          )}
        >
          <Avatar user={user} className="size-8" />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.pseudo}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </>
          )}
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
  collapsed = false,
  onToggleCollapsed,
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
      <div
        className={cn(
          'flex h-16 shrink-0 items-center',
          collapsed ? 'justify-center px-2' : 'justify-between gap-2 pl-4 pr-2',
        )}
      >
        {!collapsed && <Brand to="/hackametz" onClick={onNavigate} className="min-w-0" />}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            className="hidden size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[20px]" />
            ) : (
              <PanelLeftClose className="size-[20px]" />
            )}
          </button>
        )}
      </div>

      <SidebarSearch onSearch={onSearch} collapsed={collapsed} />

      <nav
        className={cn('flex-1 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2' : 'px-3')}
        aria-label="Navigation principale"
      >
        <SectionLabel collapsed={collapsed}>Explorer</SectionLabel>
        <NavLinks items={mainNav} onNavigate={onNavigate} collapsed={collapsed} />

        {isLoggedIn && (
          <>
            <SectionLabel collapsed={collapsed}>Moi</SectionLabel>
            <NavLinks
              items={[{ to: '/me', label: 'Mon profil', icon: User }]}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          </>
        )}

        <SectionLabel collapsed={collapsed}>
          Organisation
          {isAdmin && (
            <span className="ml-2 rounded-full bg-brand px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
              admin
            </span>
          )}
        </SectionLabel>
        <NavLinks
          items={[{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }]}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
      </nav>

      <div className={cn('shrink-0 pb-3 pt-2', collapsed ? 'px-2' : 'px-3')}>
        {isLoggedIn ? (
          <div className={collapsed ? 'flex justify-center' : undefined}>
            <UserCard
              onNavigate={onNavigate}
              theme={theme}
              onToggleTheme={onToggleTheme}
              collapsed={collapsed}
            />
          </div>
        ) : collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onEnter}
              title="Entrer avec un pseudo"
              aria-label="Entrer avec un pseudo"
              className="flex size-11 items-center justify-center rounded-full bg-brand text-white transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogIn className="size-[20px]" />
            </button>
          </div>
        ) : (
          <div className="rounded-[22px] bg-muted/60 p-4">
            <p className="text-sm font-medium">Pas de compte à créer</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Un pseudo suffit pour participer.
            </p>
            <Button size="sm" className="mt-3 w-full" onClick={onEnter}>
              <LogIn /> Entrer avec un pseudo
            </Button>
          </div>
        )}

        {canInstall && !collapsed && (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Smartphone className="size-3.5" /> Installer l’app
          </button>
        )}

        <div className={cn('mt-2', collapsed && 'flex justify-center')}>
          <button
            type="button"
            onClick={onToggleTheme}
            title={dark ? 'Thème clair' : 'Thème sombre'}
            aria-label={dark ? 'Thème clair' : 'Thème sombre'}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-full text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed ? 'size-11' : 'h-9 w-full',
            )}
          >
            {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            {!collapsed && (dark ? 'Thème clair' : 'Thème sombre')}
          </button>
        </div>

        {!collapsed && (
          <Link
            to="/hackametz"
            onClick={onNavigate}
            className="mt-1 block text-center font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
          >
            HackaMetz
          </Link>
        )}
      </div>
    </div>
  );
}
