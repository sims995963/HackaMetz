import { enterResponseSchema, meDetailsResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export const authApi = {
  enter: (pseudo: string) =>
    apiFetch('/auth/enter', { method: 'POST', body: { pseudo }, schema: enterResponseSchema }),
  me: () => apiFetch('/me', { schema: meDetailsResponseSchema }),
};
