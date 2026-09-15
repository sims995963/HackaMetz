import { searchResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export const searchApi = {
  search: (q: string) =>
    apiFetch(`/search?q=${encodeURIComponent(q)}`, { schema: searchResponseSchema }),
};
