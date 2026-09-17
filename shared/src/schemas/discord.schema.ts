import { z } from 'zod';

export const DISCORD_LINK_KINDS = ['edition', 'category', 'team'] as const;

/**
 * Ce que HackaMetz a créé sur Discord pour une édition ou une équipe.
 * Sert à ne rien recréer au redémarrage, et à tout supprimer proprement à la fin.
 */
export const discordLinkSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  /**
   * `edition` : les salons communs et leur catégorie ; `category` : une catégorie
   * supplémentaire quand la première est pleine (50 salons max) ; `team` : les salons d'une équipe.
   */
  kind: z.enum(DISCORD_LINK_KINDS),
  teamId: z.string().nullable(),
  categoryId: z.string(),
  /** Rôle qui ouvre les salons ; null hors `team`. */
  roleId: z.string().nullable(),
  /** Salon texte principal (accueil pour l'édition, salon de l'équipe) ; null pour `category`. */
  textChannelId: z.string().nullable(),
  voiceChannelId: z.string().nullable(),
  /** Salon des annonces (`edition` uniquement). */
  announcementsChannelId: z.string().nullable(),
  /** Autres salons à supprimer avec l'espace (supprimer une catégorie ne vide pas son contenu). */
  extraChannelIds: z.array(z.string()).default([]),
  /** Membres Discord qui ont reçu le rôle via /rejoindre : pour le leur retirer ensuite. */
  memberDiscordIds: z.array(z.string()).default([]),
  /** Date de suppression programmée ; null tant que l'édition n'est pas terminée. */
  closeAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type DiscordLink = z.infer<typeof discordLinkSchema>;

/** Ce que le client a besoin de savoir : le pont est-il actif, et où rejoindre. */
export const discordInfoSchema = z.object({
  inviteUrl: z.string().nullable(),
});
export type DiscordInfo = z.infer<typeof discordInfoSchema>;

/** Liens profonds vers les salons d'une équipe, quand ils existent. */
export const teamDiscordSchema = z.object({
  textChannelUrl: z.string(),
  voiceChannelUrl: z.string().nullable(),
});
export type TeamDiscord = z.infer<typeof teamDiscordSchema>;

/** État du pont, pour l'organisateur. */
export const discordStatusSchema = z.object({
  state: z.enum(['disabled', 'connecting', 'connected', 'error']),
  guildName: z.string().nullable(),
  /** Espaces (édition + équipes) actuellement ouverts sur le serveur. */
  openSpaces: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type DiscordStatus = z.infer<typeof discordStatusSchema>;
