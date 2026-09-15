import { lazy, Suspense } from 'react';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

const STYLES =
  'prose-sm max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5';

/** Rendu markdown avec la typographie du site ; le texte brut s'affiche le temps du chargement. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className={STYLES}>
      <Suspense fallback={<p className="whitespace-pre-line">{children}</p>}>
        <MarkdownRenderer>{children}</MarkdownRenderer>
      </Suspense>
    </div>
  );
}
