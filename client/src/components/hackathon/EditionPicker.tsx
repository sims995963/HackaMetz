import * as React from 'react';
import { createPortal } from 'react-dom';
import type { HackathonWithCounts } from '@hackametz/shared';
import { Check, ChevronDown, FolderArchive, Search } from 'lucide-react';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';
import { cn } from '@/lib/utils';

/** Recherche tolérante : insensible à la casse, aux accents et au « # » du code. */
function fold(value: string) {
  return (
    value
      .normalize('NFD')
      // Marques diacritiques combinantes : le « e » et le « é » doivent se répondre.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  );
}

interface EditionPickerProps {
  editions: HackathonWithCounts[];
  /** Slug de l'édition choisie, ou chaîne vide pour « toutes les éditions ». */
  value: string;
  onChange: (slug: string) => void;
  className?: string;
}

/**
 * Choix d'une édition parmi toutes celles de la plateforme.
 *
 * Une pastille par édition ne tient pas la distance : au bout de quelques années il y en
 * aura des dizaines, puis des centaines. D'où un champ de recherche et une liste défilante,
 * qui coûtent le même geste quel que soit le nombre d'éditions.
 */
export function EditionPicker({ editions, value, onChange, className }: EditionPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = React.useId();
  const position = useAnchoredPosition(rootRef, open, { align: 'end', panelRef });

  /** La plus récente en tête : c'est celle qu'on cherche neuf fois sur dix. */
  const sorted = React.useMemo(() => [...editions].sort((a, b) => b.number - a.number), [editions]);
  const selected = sorted.find((h) => h.slug === value);

  const matches = React.useMemo(() => {
    const needle = fold(query.trim()).replace(/^#/, '');
    if (!needle) return sorted;
    return sorted.filter((h) =>
      [h.code, h.title, h.theme].some((field) => fold(field).includes(needle)),
    );
  }, [sorted, query]);

  /** L'entrée « toutes » compte comme une option : elle occupe l'index 0. */
  const options: (HackathonWithCounts | null)[] = React.useMemo(
    () => (query.trim() ? matches : [null, ...matches]),
    [matches, query],
  );

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  function choose(slug: string) {
    onChange(slug);
    close();
  }

  // Une frappe repart du premier résultat, sinon la sélection clavier pointe dans le vide.
  React.useEffect(() => setActiveIndex(0), [query]);

  React.useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // L'option survolée au clavier doit rester dans la partie visible de la liste.
  // On agit sur le seul `scrollTop` de la liste : `scrollIntoView` ferait aussi défiler
  // la page derrière, et le panneau — positionné en `fixed` — partirait hors de l'écran.
  React.useEffect(() => {
    if (!open) return;
    const list = panelRef.current?.querySelector<HTMLElement>('[role="listbox"]');
    const option = list?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }, [open, activeIndex]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const option = options[activeIndex];
      if (options.length > 0) choose(option ? option.slug : '');
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + step + options.length) % options.length);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          'inline-flex h-8 max-w-[min(18rem,70vw)] items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-all',
          selected
            ? 'border-transparent bg-brand text-white shadow-soft'
            : 'border-border/70 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
        )}
      >
        {selected ? (
          <span
            className="size-2 shrink-0 rounded-full ring-2 ring-white/60"
            style={{ background: selected.coverColor }}
            aria-hidden
          />
        ) : (
          <FolderArchive className="size-3.5 shrink-0" aria-hidden />
        )}
        <span className="truncate">
          {selected ? `#${selected.code} ${selected.title}` : 'Toutes les éditions'}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={position}
            onKeyDown={onKeyDown}
            className="floating-surface animate-menu-in z-50 w-[min(92vw,22rem)] rounded-[22px] border border-border/60 p-2 text-popover-foreground"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={options.length > 0 ? `${listId}-${activeIndex}` : undefined}
                aria-label="Rechercher une édition"
                placeholder="Rechercher une édition…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-full border border-border/60 bg-background/70 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/15"
              />
            </div>

            <div id={listId} role="listbox" className="mt-2 max-h-72 overflow-y-auto">
              {options.length === 0 ? (
                <p className="px-3.5 py-8 text-center text-sm text-muted-foreground">
                  Aucune édition ne correspond à « {query.trim()} ».
                </p>
              ) : (
                options.map((h, index) => (
                  <Option
                    key={h?.id ?? 'all'}
                    index={index}
                    id={`${listId}-${index}`}
                    active={index === activeIndex}
                    selected={h ? h.slug === value : value === ''}
                    onPointerMove={() => setActiveIndex(index)}
                    onClick={() => choose(h ? h.slug : '')}
                  >
                    {h ? (
                      <>
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: h.coverColor }}
                          aria-hidden
                        />
                        <span className="font-mono text-xs text-muted-foreground">#{h.code}</span>
                        <span className="truncate">{h.title}</span>
                      </>
                    ) : (
                      <>
                        <FolderArchive className="size-4 shrink-0 text-muted-foreground" />
                        <span>Toutes les éditions</span>
                      </>
                    )}
                  </Option>
                ))
              )}
            </div>

            <p className="mt-1 border-t border-border/60 px-3.5 pt-2 text-[11px] text-muted-foreground">
              {matches.length} édition{matches.length > 1 ? 's' : ''}
              {query.trim() ? ` sur ${sorted.length}` : ''}
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}

function Option({
  index,
  id,
  active,
  selected,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  index: number;
  id: string;
  active: boolean;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      role="option"
      id={id}
      data-index={index}
      aria-selected={selected}
      tabIndex={-1}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-full px-3.5 text-left text-sm outline-none transition-colors',
        active && 'bg-accent text-accent-foreground',
      )}
      {...props}
    >
      {children}
      {selected && <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden />}
    </button>
  );
}
