import * as React from 'react';

/** Marge minimale entre le panneau et les bords de la fenêtre. */
const MARGIN = 8;

export interface AnchorOptions {
  align?: 'start' | 'end';
  side?: 'bottom' | 'top';
  /**
   * Le panneau lui-même. Fourni, il est mesuré : le placement est alors recadré pour
   * rester dans la fenêtre, et bascule au-dessus du déclencheur s'il manque de place
   * en dessous. Sans lui, le panneau est simplement aligné sur le déclencheur.
   */
  panelRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Place un panneau flottant par rapport à son déclencheur, en `position: fixed`.
 * Rendu dans un portail, le panneau n'est alors jamais rogné par un conteneur
 * défilant (tableau, carte) ; il suit le déclencheur au défilement et au redimensionnement.
 *
 * Renvoie le style à poser sur le panneau — vide tant qu'il est fermé.
 */
export function useAnchoredPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  { align = 'end', side = 'bottom', panelRef }: AnchorOptions = {},
): React.CSSProperties {
  const [position, setPosition] = React.useState<React.CSSProperties>({});

  React.useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panel = panelRef?.current;
      const style: React.CSSProperties = { position: 'fixed' };

      // Horizontal : aligné sur un bord du déclencheur, sans jamais sortir de la fenêtre.
      const room = panel ? Math.max(MARGIN, window.innerWidth - panel.offsetWidth - MARGIN) : null;
      const clamp = (offset: number) =>
        room === null ? Math.max(MARGIN, offset) : Math.min(Math.max(MARGIN, offset), room);
      if (align === 'end') style.right = clamp(window.innerWidth - rect.right);
      else style.left = clamp(rect.left);

      // Vertical : sous le déclencheur par défaut, au-dessus si la place y est plus grande.
      const below = window.innerHeight - rect.bottom - MARGIN;
      const above = rect.top - MARGIN;
      const height = panel?.offsetHeight ?? 0;
      const placeAbove =
        side === 'top' ? above >= height || above > below : height > below && above > below;
      if (placeAbove) style.bottom = Math.max(MARGIN, window.innerHeight - rect.top + MARGIN);
      else style.top = rect.bottom + MARGIN;

      setPosition(style);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, panelRef, open, align, side]);

  return position;
}
