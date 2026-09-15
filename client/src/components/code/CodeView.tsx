import { useMemo } from 'react';
import { highlight } from './highlight';

/** Bloc de code avec numéros de ligne et coloration syntaxique quand le langage est connu. */
export function CodeView({ code, path }: { code: string; path: string }) {
  const html = useMemo(() => highlight(code, path), [code, path]);
  const lines = useMemo(() => (html ?? escapeHtml(code)).split('\n'), [html, code]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs leading-relaxed">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="hover:bg-accent/40">
              <td className="w-10 select-none border-r pr-3 text-right align-top text-muted-foreground/70">
                {index + 1}
              </td>
              <td className="whitespace-pre pl-4 align-top">
                <span className="hljs" dangerouslySetInnerHTML={{ __html: line || ' ' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
