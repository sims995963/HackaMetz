import * as React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';
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
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  const position = useAnchoredPosition(rootRef, open, { align, side, panelRef });

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
              className="floating-surface animate-menu-in z-50 min-w-56 rounded-[22px] border border-border/60 p-2 text-popover-foreground"
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
  'flex h-10 w-full cursor-pointer items-center gap-3 rounded-full px-3.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50';

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
    <p className="px-3.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-border/60" role="separator" />;
}
