import { z } from 'zod';
import { teamDiscordSchema } from './discord.schema';
import { participantSchema } from './registration.schema';

export const teamNameSchema = z
  .string()
  .trim()
  .min(2, 'Au moins 2 caractères')
  .max(40, '40 caractères max');

/** Entité stockée : le code d'invitation n'est montré qu'aux membres. */
export const teamSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: teamNameSchema,
  slug: z.string(),
  inviteCode: z.string(),
  leaderId: z.string(),
  memberIds: z.array(z.string()),
  createdAt: z.iso.datetime(),
});
export type Team = z.infer<typeof teamSchema>;

export const teamMemberSchema = participantSchema.pick({
  id: true,
  pseudo: true,
  avatarSeed: true,
});

/** Vue publique d'une équipe (liste des équipes du hackathon). */
export const teamPublicSchema = teamSchema.omit({ inviteCode: true, memberIds: true }).extend({
  members: z.array(teamMemberSchema),
});
export type TeamPublic = z.infer<typeof teamPublicSchema>;

/** Vue d'un membre : avec le code d'invitation à partager. */
export const teamMineSchema = teamPublicSchema.extend({
  inviteCode: z.string(),
  /** Salons Discord de l'équipe, quand le pont est actif et les a créés. */
  discord: teamDiscordSchema.nullable().default(null),
});
export type TeamMine = z.infer<typeof teamMineSchema>;

export const createTeamInputSchema = z.object({ name: teamNameSchema });
export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

export const joinTeamInputSchema = z.object({
  inviteCode: z.string().trim().min(4, 'Code invalide').max(16, 'Code invalide'),
});
export type JoinTeamInput = z.infer<typeof joinTeamInputSchema>;

export const teamResponseSchema = z.object({ team: teamMineSchema });
export type TeamResponse = z.infer<typeof teamResponseSchema>;

export const teamsResponseSchema = z.object({ teams: z.array(teamPublicSchema) });
export type TeamsResponse = z.infer<typeof teamsResponseSchema>;
