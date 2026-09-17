import { useSessionStore } from '@/store/session.store';

/**
 * Télécharge un fichier servi par l'API (CSV d'export) : il faut passer par fetch
 * pour envoyer la clé d'organisateur, puis simuler un clic sur un lien temporaire.
 */
export async function downloadApiFile(path: string, fallbackName: string): Promise<void> {
  const { token, adminKey } = useSessionStore.getState();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;

  const response = await fetch(`/api${path}`, { headers });
  if (!response.ok) {
    // L'API explique pourquoi (édition vide, archive trop lourde, git absent) : autant le dire.
    const detail = await response
      .json()
      .then((body: { error?: { message?: string } }) => body.error?.message)
      .catch(() => undefined);
    throw new Error(detail ?? `Téléchargement impossible (${response.status})`);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
