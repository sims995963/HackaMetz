import { Code2, Download, FileArchive, FolderArchive, Library } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu';
import { downloadApiFile } from '@/lib/download';
import { useSessionStore } from '@/store/session.store';

interface Props {
  /** Projet à proposer en premier, sur la page d'un projet. */
  project?: { id: string; title: string } | null;
  /** Édition à proposer, quand le contexte en désigne une. */
  edition?: { slug: string; code: string; title: string } | null;
  /** Masque l'entrée « toute la base » là où elle n'a pas de sens. */
  knowledgeBase?: boolean;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
}

/**
 * Téléchargement du code en zip : un projet, une édition entière, toute la base,
 * et — pour l'organisateur — le code de l'application elle-même.
 *
 * L'archive est construite à la volée par le serveur ; sur une grosse base cela prend
 * quelques secondes, d'où le retour visuel pendant la préparation.
 */
export function DownloadMenu({
  project,
  edition,
  knowledgeBase = true,
  label = 'Télécharger',
  variant = 'outline',
  size = 'default',
}: Props) {
  const isAdmin = useSessionStore((s) => Boolean(s.adminKey));

  function download(path: string, fileName: string, what: string) {
    void toast.promise(downloadApiFile(path, fileName), {
      loading: `Préparation de l’archive : ${what}…`,
      success: `${what} — archive téléchargée`,
      error: (err: unknown) =>
        err instanceof Error ? err.message : 'Téléchargement impossible pour le moment',
    });
  }

  return (
    <Menu
      align="end"
      trigger={({ open, toggle }) => (
        <Button variant={variant} size={size} onClick={toggle} aria-expanded={open}>
          <Download /> {label}
        </Button>
      )}
    >
      <MenuLabel>Télécharger en zip</MenuLabel>

      {project && (
        <MenuItem
          onClick={() =>
            download(
              `/submissions/${encodeURIComponent(project.id)}/download.zip`,
              'projet.zip',
              project.title,
            )
          }
        >
          <FileArchive /> Ce projet
        </MenuItem>
      )}

      {edition && (
        <MenuItem
          onClick={() =>
            download(
              `/hackathons/${encodeURIComponent(edition.slug)}/download.zip`,
              `hackametz-${edition.code}.zip`,
              `#${edition.code} ${edition.title}`,
            )
          }
        >
          <FolderArchive /> Tous les projets de #{edition.code}
        </MenuItem>
      )}

      {knowledgeBase && (
        <MenuItem
          onClick={() =>
            download(
              '/kb/download.zip',
              'hackametz-base-de-connaissance.zip',
              'Base de connaissance',
            )
          }
        >
          <Library /> Toute la base de connaissance
        </MenuItem>
      )}

      {isAdmin && (
        <>
          <MenuSeparator />
          <MenuLabel>Organisateur</MenuLabel>
          <MenuItem
            onClick={() =>
              download('/app/source.zip', 'hackametz-app.zip', 'Code de l’application')
            }
          >
            <Code2 /> Code de l’application
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
