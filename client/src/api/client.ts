import type { z } from 'zod';
import { apiErrorSchema, type ApiErrorCode } from '@hackametz/shared';
import { useSessionStore } from '@/store/session.store';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Schéma zod de la réponse : on vérifie ce que le serveur renvoie, pas seulement ce qu'on lui envoie. */
  schema: z.ZodType<T>;
}

/** Point d'entrée unique vers l'API : en-têtes de session, JSON, erreurs typées. */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, schema }: RequestOptions<T>,
): Promise<T> {
  const { token, adminKey } = useSessionStore.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'INTERNAL_ERROR', 'Impossible de joindre le serveur. Est-il lancé ?');
  }

  const json: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Erreur ${response.status}`);
  }

  return schema.parse(json);
}
