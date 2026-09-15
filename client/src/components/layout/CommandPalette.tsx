import { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SearchResultType } from '@hackametz/shared';
import {
  CornerDownLeft,
  FolderArchive,
  Home,
  LayoutDashboard,
  Lightbulb,
  Package,
  Search,
  Sparkles,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSearch, useDebounced } from '@/hooks/useSearch';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Item {
  key: string;
  title: string;
  subtitle: string;
  to: string;
  icon: typeof Home;
  badge?: string | null;
  color?: string | null;
  group: string;
}

const TYPE_ICON: Record<SearchResultType, typeof Home> = {
  hackathon: Trophy,
  project: Package,
  tech: Sparkles,
  person: Users,
};
const TYPE_GROUP: Record<SearchResultType, string> = {
  hackathon: 'Éditions',
  project: 'Projets',
  tech: 'Technologies',
  person: 'Pseudos',
};

function toItem(result: SearchResult): Item {
  return {
    key: `${result.type}:${result.id}`,
    title: result.title,
    subtitle: result.subtitle,
    to: result.to,
    icon: TYPE_ICON[result.type],
    badge: result.badge,
    color: result.coverColor,
    group: TYPE_GROUP[result.type],
  };
}

/**
 * Palette de commandes (⌘K / Ctrl+K, ou « / ») : aller n'importe où et chercher
 * dans les éditions, les projets, les technos et les pseudos sans quitter le clavier.
 */
export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin } = useSession();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query);
  const { data, isFetching } = useSearch(debounced);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery('');
      setActive(0);
      // Le focus arrive après l'ouverture, sinon Safari le perd.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const navigation: Item[] = useMemo(() => {
    const base: Item[] = [
      {
        key: 'nav:home',
        title: 'Accueil',
        subtitle: 'Présentation de la plateforme',
        to: '/',
        icon: Home,
        group: 'Aller à',
      },
      {
        key: 'nav:hackathons',
        title: 'Hackathons',
        subtitle: 'Toutes les éditions',
        to: '/hackathons',
        icon: Trophy,
        group: 'Aller à',
      },
      {
        key: 'nav:proposals',
        title: 'Propositions',
        subtitle: 'Voter pour la prochaine édition',
        to: '/propositions',
        icon: Lightbulb,
        group: 'Aller à',
      },
      {
        key: 'nav:kb',
        title: 'Base de connaissance',
        subtitle: 'Tous les projets archivés',
        to: '/kb',
        icon: FolderArchive,
        group: 'Aller à',
      },
    ];
    if (isLoggedIn) {
      base.push({
        key: 'nav:me',
        title: 'Mon profil',
        subtitle: 'Palmarès, projets, certificats',
        to: '/me',
        icon: User,
        group: 'Aller à',
      });
    }
    if (isAdmin) {
      base.push(
        {
          key: 'nav:admin',
          title: 'Dashboard organisateur',
          subtitle: 'Statuts, activité, export',
          to: '/admin',
          icon: LayoutDashboard,
          group: 'Organisation',
        },
        {
          key: 'nav:new-hackathon',
          title: 'Nouveau hackathon',
          subtitle: 'Créer une édition',
          to: '/admin/hackathons/new',
          icon: Trophy,
          group: 'Organisation',
        },
        {
          key: 'nav:new-round',
          title: 'Nouveau tour de propositions',
          subtitle: 'Trois idées à soumettre au vote',
          to: '/admin/propositions/new',
          icon: Lightbulb,
          group: 'Organisation',
        },
      );
    }
    return base;
  }, [isLoggedIn, isAdmin]);

  const items: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return navigation;
    const local = navigation.filter((item) => item.title.toLowerCase().includes(q));
    const remote = (data?.results ?? []).map(toItem);
    const extra: Item[] = [
      {
        key: 'action:kb-search',
        title: `Chercher « ${query.trim()} » dans la base`,
        subtitle: 'Recherche plein texte sur tous les projets',
        to: `/kb?q=${encodeURIComponent(query.trim())}`,
        icon: Search,
        group: 'Actions',
      },
    ];
    return [...remote, ...local, ...extra];
  }, [query, navigation, data]);

  useEffect(() => setActive(0), [items.length, debounced]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(item: Item | undefined) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[active]);
    }
  }

  // Les en-têtes de groupe sont insérés au vol, l'index reste celui de `items`.
  let lastGroup = '';

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-label="Recherche et navigation"
      className="m-0 mx-auto mt-[8vh] w-[min(94vw,40rem)] rounded-2xl border border-border/70 bg-card p-0 text-card-foreground shadow-pop backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          type="text"
          placeholder="Chercher une édition, un projet, une techno…"
          aria-label="Chercher"
          className="h-12 w-full bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
        />
        {isFetching && (
          <span
            className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <ul ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
        {items.length === 0 && (
          <li className="px-3 py-10 text-center text-sm text-muted-foreground">
            {isFetching ? 'Recherche…' : `Rien trouvé pour « ${query.trim()} »`}
          </li>
        )}
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const Icon = item.icon;
          const isActive = index === active;
          return (
            <li key={item.key}>
              {header && (
                <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 first:mt-1">
                  {header}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                data-active={isActive}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                  isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                    item.color ? 'text-white' : 'bg-muted text-muted-foreground',
                  )}
                  style={item.color ? { background: item.color } : undefined}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                </span>
                {item.badge && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center gap-4 border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> naviguer
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd> ouvrir
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>Échap</Kbd> fermer
        </span>
      </footer>
    </dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border/70 bg-background px-1.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}
