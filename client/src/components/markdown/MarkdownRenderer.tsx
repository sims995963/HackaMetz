import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Chargé à la demande : react-markdown et ses dépendances pèsent lourd. */
export default function MarkdownRenderer({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
