import { useEffect, useState } from 'react';
import { Menu as MenuIcon, Search, X } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { Brand } from '@/components/layout/Brand';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { SidebarContent } from '@/components/layout/Sidebar';
import { PseudoDialog } from '@/components/session/PseudoDialog';
import { Button } from '@/components/ui/button';
import { applyTheme, getStoredTheme, resolveTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export interface ShellContext {
  openPseudoDialog: () => void;
  openCommandPalette: () => void;
}

export function AppShell() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const location = useLocation();

  // Le tiroir mobile se referme à chaque navigation.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // ⌘K / Ctrl+K partout, « / » quand on n'est pas déjà en train d'écrire.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function toggleTheme() {
    const next: Theme = resolveTheme(theme) === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  const openPseudoDialog = () => setDialogOpen(true);
  const openCommandPalette = () => setPaletteOpen(true);

  return (
    <div className="min-h-svh">
      <div className="app-bg print:hidden" aria-hidden />
      <div className="app-grid print:hidden" aria-hidden />

      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-border/60 print:hidden lg:block">
        <SidebarContent
          onEnter={openPseudoDialog}
          onSearch={openCommandPalette}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden',
          drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[288px] border-r border-border/60 bg-card shadow-pop transition-transform duration-200 lg:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu"
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-3 z-10"
          aria-label="Fermer le menu"
          onClick={() => setDrawerOpen(false)}
        >
          <X />
        </Button>
        <SidebarContent
          onNavigate={() => setDrawerOpen(false)}
          onEnter={() => {
            setDrawerOpen(false);
            openPseudoDialog();
          }}
          onSearch={() => {
            setDrawerOpen(false);
            openCommandPalette();
          }}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </aside>

      <div className="lg:pl-[264px] print:pl-0">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 px-4 print:hidden lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ouvrir le menu"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon />
          </Button>
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Rechercher"
            onClick={openCommandPalette}
          >
            <Search />
          </Button>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-10 lg:py-10">
          <div key={location.pathname} className="animate-page-in">
            <Outlet context={{ openPseudoDialog, openCommandPalette } satisfies ShellContext} />
          </div>
        </main>

        <footer className="px-4 pb-24 pt-2 text-center text-xs text-muted-foreground lg:px-10 lg:pb-8 lg:pt-8">
          HackaMetz — chaque hackathon archivé dans{' '}
          <span className="font-mono">storage/hackathons/NNN-…/projects/</span>
        </footer>
      </div>

      <MobileTabBar onEnter={openPseudoDialog} />
      <PseudoDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
