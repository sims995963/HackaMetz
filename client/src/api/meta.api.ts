import { serverTimeResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export const metaApi = {
  time: () => apiFetch('/time', { schema: serverTimeResponseSchema }),
};
