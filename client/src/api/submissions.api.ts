import {
  apiErrorSchema,
  fileContentResponseSchema,
  submissionListResponseSchema,
  submissionResponseSchema,
  treeResponseSchema,
  type SubmissionMetaInput,
  type SubmissionResponse,
} from '@hackametz/shared';
import { useSessionStore } from '@/store/session.store';
import { ApiError, apiFetch } from './client';

export interface UploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Dépôt d'un projet : multipart (archive + meta) via XMLHttpRequest, le seul moyen
 * d'avoir la progression de l'envoi dans tous les navigateurs.
 */
export function uploadSubmission(
  slug: string,
  archive: Blob,
  meta: SubmissionMetaInput,
  { onProgress, signal }: UploadOptions = {},
): Promise<SubmissionResponse> {
  const { token } = useSessionStore.getState();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/hackathons/${encodeURIComponent(slug)}/submissions`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () =>
      reject(new ApiError(0, 'INTERNAL_ERROR', 'Envoi interrompu. Le serveur est-il joignable ?'));
    xhr.onabort = () => reject(new ApiError(0, 'INTERNAL_ERROR', 'Envoi annulé'));
    xhr.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        json = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const parsed = submissionResponseSchema.safeParse(json);
        if (parsed.success) resolve(parsed.data);
        else reject(new ApiError(xhr.status, 'INTERNAL_ERROR', 'Réponse inattendue du serveur'));
        return;
      }
      const error = apiErrorSchema.safeParse(json);
      if (error.success) {
        const { code, message, details } = error.data.error;
        reject(new ApiError(xhr.status, code, message, details));
      } else {
        reject(new ApiError(xhr.status, 'INTERNAL_ERROR', `Erreur ${xhr.status}`));
      }
    };

    signal?.addEventListener('abort', () => xhr.abort());

    const form = new FormData();
    form.append('meta', JSON.stringify(meta));
    form.append('archive', archive, 'projet.zip');
    xhr.send(form);
  });
}

export const submissionsApi = {
  listForHackathon: (slug: string) =>
    apiFetch(`/hackathons/${encodeURIComponent(slug)}/submissions`, {
      schema: submissionListResponseSchema,
    }),
  get: (id: string) =>
    apiFetch(`/submissions/${encodeURIComponent(id)}`, { schema: submissionResponseSchema }),
  tree: (id: string) =>
    apiFetch(`/submissions/${encodeURIComponent(id)}/tree`, { schema: treeResponseSchema }),
  setStatus: (id: string, status: 'submitted' | 'disqualified') =>
    apiFetch(`/submissions/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: { status },
      schema: submissionResponseSchema,
    }),
  file: (id: string, path: string) =>
    apiFetch(`/submissions/${encodeURIComponent(id)}/file?path=${encodeURIComponent(path)}`, {
      schema: fileContentResponseSchema,
    }),
};
