import { z } from 'zod';

/**
 * Trace d'une action d'organisateur. Écrite automatiquement pour toute requête
 * authentifiée par la clé admin qui modifie quelque chose.
 */
export const auditEntrySchema = z.object({
  id: z.string(),
  at: z.iso.datetime(),
  /** Pseudo de l'organisateur s'il était aussi identifié, sinon null. */
  actorPseudo: z.string().nullable(),
  method: z.string(),
  path: z.string(),
  status: z.number().int(),
  /** Phrase lisible : « Changement de statut », « Disqualification d'un projet »… */
  label: z.string(),
  /** Adresse d'origine, utile quand plusieurs personnes ont la clé. */
  ip: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditListResponseSchema = z.object({
  entries: z.array(auditEntrySchema),
  total: z.number().int(),
});
export type AuditListResponse = z.infer<typeof auditListResponseSchema>;
