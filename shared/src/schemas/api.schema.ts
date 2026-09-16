import { z } from 'zod';

/** Codes d'erreur renvoyés par l'API — le client s'en sert pour adapter ses messages. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'PSEUDO_TAKEN',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const serverTimeResponseSchema = z.object({
  /** Heure serveur ISO, référence des comptes à rebours. */
  now: z.iso.datetime(),
});
export type ServerTimeResponse = z.infer<typeof serverTimeResponseSchema>;

/** Ce qu'il faut surveiller pendant un événement : place disque, volume archivé, sauvegarde. */
export const diagnosticsSchema = z.object({
  dataBytes: z.number().int(),
  storageBytes: z.number().int(),
  storageFiles: z.number().int(),
  diskFreeBytes: z.number().int(),
  diskTotalBytes: z.number().int(),
  /** Dernière sauvegarde trouvée dans `server/backups` (null si aucune). */
  lastBackupAt: z.iso.datetime().nullable(),
});
export type Diagnostics = z.infer<typeof diagnosticsSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptimeSeconds: z.number(),
  diagnostics: diagnosticsSchema,
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
