import { adminUsersResponseSchema, userSchema } from '@hackametz/shared';
import { z } from 'zod';
import { apiFetch } from './client';

export const usersApi = {
  list: () => apiFetch('/admin/users', { schema: adminUsersResponseSchema }),
  /** Détache tous les appareils d'un pseudo : le prochain « entrer » le récupère. */
  release: (id: string) =>
    apiFetch(`/admin/users/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      schema: z.object({ user: userSchema }),
    }),
};
