import { z } from 'zod';

export const SEARCH_RESULT_TYPES = ['hackathon', 'project', 'tech', 'person'] as const;
export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number];

/** Un résultat de la recherche globale, prêt à afficher et à ouvrir. */
export const searchResultSchema = z.object({
  type: z.enum(SEARCH_RESULT_TYPES),
  id: z.string(),
  title: z.string(),
  /** Ligne secondaire : édition, auteur, nombre de projets… */
  subtitle: z.string(),
  /** Chemin interne à ouvrir (react-router). */
  to: z.string(),
  /** Numéro d'édition (`001`) quand le résultat en dépend. */
  code: z.string().nullable().default(null),
  coverColor: z.string().nullable().default(null),
  /** Pastille de droite : statut du hackathon, rang du projet… */
  badge: z.string().nullable().default(null),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
