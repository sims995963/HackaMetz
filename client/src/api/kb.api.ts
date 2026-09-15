import { kbExportResponseSchema, kbProjectsResponseSchema } from '@hackametz/shared';
import { apiFetch } from './client';

export interface KbFilters {
  q?: string;
  tech?: string;
  hackathon?: string;
}

export const kbApi = {
  projects: (filters: KbFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const qs = params.toString();
    return apiFetch(`/kb/projects${qs ? `?${qs}` : ''}`, { schema: kbProjectsResponseSchema });
  },
  export: (commit: boolean) =>
    apiFetch('/admin/kb/export', {
      method: 'POST',
      body: { commit },
      schema: kbExportResponseSchema,
    }),
};
