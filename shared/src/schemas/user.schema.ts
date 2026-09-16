import { z } from 'zod';
import {
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
  PSEUDO_REGEX,
  RESERVED_PSEUDOS,
  USER_ROLES,
} from '../constants';

export const pseudoSchema = z
  .string()
  .trim()
  .min(PSEUDO_MIN_LENGTH, `Au moins ${PSEUDO_MIN_LENGTH} caractères`)
  .max(PSEUDO_MAX_LENGTH, `Au plus ${PSEUDO_MAX_LENGTH} caractères`)
  .regex(PSEUDO_REGEX, 'Lettres, chiffres, _ et - uniquement')
  .refine(
    (pseudo) => !(RESERVED_PSEUDOS as readonly string[]).includes(pseudo.toLowerCase()),
    'Ce pseudo est réservé',
  );

/** Représentation publique d'un utilisateur — jamais de secret dedans. */
export const userSchema = z.object({
  id: z.string(),
  pseudo: pseudoSchema,
  /** Pseudo en minuscules, sert à garantir l'unicité (Simon = simon). */
  pseudoNormalized: z.string(),
  /** Graine pour l'avatar généré côté client. */
  avatarSeed: z.string(),
  role: z.enum(USER_ROLES),
  createdAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const enterInputSchema = z.object({
  pseudo: pseudoSchema,
});
export type EnterInput = z.infer<typeof enterInputSchema>;

export const enterResponseSchema = z.object({
  user: userSchema,
  /** Token d'appareil à renvoyer en `Authorization: Bearer …`. */
  token: z.string(),
  /** Vrai si le pseudo vient d'être créé. */
  created: z.boolean(),
});
export type EnterResponse = z.infer<typeof enterResponseSchema>;

export const meResponseSchema = z.object({
  user: userSchema,
});

/** Vue organisateur d'un pseudo : le nombre d'appareils liés dit s'il est bloqué ailleurs. */
export const adminUserSchema = userSchema.extend({
  devices: z.number().int().nonnegative(),
  /** Nombre d'éditions rejointes, pour distinguer un curieux d'un participant. */
  registrations: z.number().int().nonnegative(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersResponseSchema = z.object({ users: z.array(adminUserSchema) });
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

/** Résumé d'un hackathon dans le profil. */
export const hackathonRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  slug: z.string(),
  title: z.string(),
  status: z.string(),
  coverColor: z.string(),
  submissionDeadlineAt: z.iso.datetime(),
});
export type HackathonRef = z.infer<typeof hackathonRefSchema>;

export const myTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  memberPseudos: z.array(z.string()),
  isLeader: z.boolean(),
});

export const myRegistrationSchema = z.object({
  hackathon: hackathonRefSchema,
  joinedAt: z.iso.datetime(),
  team: myTeamSchema.nullable().default(null),
});

export const mySubmissionSchema = z.object({
  id: z.string(),
  hackathon: hackathonRefSchema,
  title: z.string(),
  status: z.string(),
  version: z.number().int(),
  submittedAt: z.iso.datetime(),
});

/** Palmarès calculé à la volée à partir des inscriptions, projets, classements et votes. */
export const ACHIEVEMENT_IDS = [
  'first_steps',
  'builder',
  'team_player',
  'podium_1',
  'podium_2',
  'podium_3',
  'crowd_favorite',
  'juror',
  'veteran',
  'curious',
] as const;
export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export const achievementSchema = z.object({
  id: z.enum(ACHIEVEMENT_IDS),
  label: z.string(),
  description: z.string(),
  /** Hackathon où le succès a été obtenu (null pour les succès globaux). */
  hackathon: hackathonRefSchema.nullable(),
  earnedAt: z.iso.datetime(),
});
export type Achievement = z.infer<typeof achievementSchema>;

/** Résultat final d'un participant sur une édition terminée (pour le certificat). */
export const myResultSchema = z.object({
  hackathon: hackathonRefSchema,
  submissionId: z.string(),
  title: z.string(),
  rank: z.number().int(),
  total: z.number().int(),
  score: z.number().nullable(),
  prize: z.string().nullable(),
  publicFavorite: z.boolean(),
  teamName: z.string().nullable(),
  teamMembers: z.array(z.string()),
});
export type MyResult = z.infer<typeof myResultSchema>;

export const meDetailsResponseSchema = z.object({
  user: userSchema,
  registrations: z.array(myRegistrationSchema),
  submissions: z.array(mySubmissionSchema),
  results: z.array(myResultSchema).default([]),
  achievements: z.array(achievementSchema).default([]),
});
export type MeDetailsResponse = z.infer<typeof meDetailsResponseSchema>;
