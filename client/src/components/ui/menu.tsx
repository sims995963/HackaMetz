import * as React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

interface MenuContextValue {
  close: () => void;
}
const MenuContext = React.createContext<MenuContextValue>({ close: () => undefined });

interface MenuProps {
  /** Le déclencheur reçoit `open` pour adapter son apparence. */
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  className?: string;
}

/**
 * Menu déroulant léger, sans dépendance : se ferme au clic extérieur, à Échap et après un choix.
 * Navigation clavier : flèches haut/bas entre les éléments.
 */
export function Menu({ trigger, children, align = 'end', side = 'bottom', className }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<React.CSSProperties>({});
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  // Rendu dans un portail, positionné en `fixed` à partir du déclencheur : jamais rogné par
  // un conteneur défilant (tableau, carte). Suit le déclencheur au défilement.
  React.useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const style: React.CSSProperties = { position: 'fixed' };
      if (align === 'end') style.right = Math.max(8, window.innerWidth - rect.right);
      else style.left = rect.left;
      if (side === 'bottom') style.top = rect.bottom + 8;
      else style.bottom = Math.max(8, window.innerHeight - rect.top + 8);
      setPosition(style);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, align, side]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        if (items.length === 0) return;
        e.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === 'ArrowDown'
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length;
        items[next]?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  React.useEffect(() => {
    if (open)
      panelRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <MenuContext.Provider value={{ close }}>
            <div
              ref={panelRef}
              role="menu"
              style={position}
              className="z-50 min-w-52 rounded-xl border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-pop animate-menu-in"
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </div>
  );
}

const itemClass =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50';

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function MenuItem({ className, destructive, onClick, ...props }: MenuItemProps) {
  const { close } = React.useContext(MenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        itemClass,
        destructive &&
          'text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive',
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        close();
      }}
      {...props}
    />
  );
}

export function MenuLink({
  className,
  to,
  children,
}: {
  className?: string;
  to: string;
  children: React.ReactNode;
}) {
  const { close } = React.useContext(MenuContext);
  return (
    <Link to={to} role="menuitem" className={cn(itemClass, className)} onClick={close}>
      {children}
    </Link>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-border/70" role="separator" />;
}
