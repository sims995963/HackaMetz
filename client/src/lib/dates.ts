import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatDateTime = (iso: string) =>
  format(new Date(iso), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr });
export const formatDate = (iso: string) => format(new Date(iso), 'd MMM yyyy', { locale: fr });
export const formatShort = (iso: string) => format(new Date(iso), 'd MMM, HH:mm', { locale: fr });

/** "12 mars → 14 mars 2026" ou "12 mars 2026" si même jour. */
export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isSameDay(start, end)) return format(start, 'd MMMM yyyy', { locale: fr });
  return `${format(start, 'd MMM', { locale: fr })} → ${format(end, 'd MMM yyyy', { locale: fr })}`;
}

export const fromNow = (iso: string) =>
  formatDistanceToNowStrict(new Date(iso), { locale: fr, addSuffix: true });
