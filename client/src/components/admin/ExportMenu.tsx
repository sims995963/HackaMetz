import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/menu';
import { downloadApiFile } from '@/lib/download';

const EXPORTS = [
  { kind: 'participants', label: 'Participants' },
  { kind: 'projets', label: 'Projets déposés' },
  { kind: 'resultats', label: 'Classement du jury' },
  { kind: 'retours', label: 'Retours des participants' },
] as const;

interface Props {
  slug: string;
  /** Rendu compact pour une ligne de tableau. */
  trigger?: 'button' | 'link';
}

/** Exports tableur de l'organisateur (émargement, classement, retours). */
export function ExportMenu({ slug, trigger = 'button' }: Props) {
  async function download(kind: string, label: string) {
    try {
      await downloadApiFile(
        `/hackathons/${encodeURIComponent(slug)}/exports/${kind}.csv`,
        `${kind}.csv`,
      );
      toast.success(`${label} exporté en CSV`);
    } catch {
      toast.error('Export impossible');
    }
  }

  return (
    <Menu
      align="end"
      trigger={({ open, toggle }) =>
        trigger === 'link' ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Download className="size-3.5" /> Exporter
          </button>
        ) : (
          <Button variant="outline" onClick={toggle} aria-expanded={open}>
            <FileSpreadsheet /> Exporter en CSV
          </Button>
        )
      }
    >
      <MenuLabel>Export CSV</MenuLabel>
      {EXPORTS.map(({ kind, label }) => (
        <MenuItem key={kind} onClick={() => void download(kind, label)}>
          <Download /> {label}
        </MenuItem>
      ))}
    </Menu>
  );
}
