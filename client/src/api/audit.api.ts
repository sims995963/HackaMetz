import { auditListResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export const auditApi = {
  list: (limit = 30) =>
    apiFetch(`/admin/audit?limit=${limit}`, { schema: auditListResponseSchema }),
};
