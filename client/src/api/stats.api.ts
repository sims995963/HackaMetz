import { adminStatsSchema, publicStatsSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export const statsApi = {
  public: () => apiFetch('/stats', { schema: publicStatsSchema }),
  admin: () => apiFetch('/admin/stats', { schema: adminStatsSchema }),
};
