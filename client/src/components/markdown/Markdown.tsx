import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

interface Props {
  children: string;
  /** « sm » pour un panneau latéral ou une carte, « base » pour un texte qu'on lit vraiment. */
  size?: 'sm' | 'base';
  className?: string;
}

/** Rendu markdown avec la typographie du site ; le texte brut s'affiche le temps du chargement. */
export function Markdown({ children, size = 'base', className }: Props) {
  return (
    <div className={cn('prose-hm', size === 'sm' && 'prose-hm-sm', className)}>
      <Suspense fallback={<p className="whitespace-pre-line">{children}</p>}>
        <MarkdownRenderer>{children}</MarkdownRenderer>
      </Suspense>
    </div>
  );
}
