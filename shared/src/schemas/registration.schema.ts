import { z } from 'zod';
import { userSchema } from './user.schema';

export const registrationSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  userId: z.string(),
  teamId: z.string().nullable().default(null),
  acceptedRulesAt: z.iso.datetime(),
  joinedAt: z.iso.datetime(),
});
export type Registration = z.infer<typeof registrationSchema>;

export const joinInputSchema = z.object({
  acceptRules: z.literal(true, 'Tu dois accepter le règlement pour participer'),
  accessCode: z.string().trim().optional(),
});
export type JoinInput = z.infer<typeof joinInputSchema>;

export const registrationResponseSchema = z.object({
  registration: registrationSchema,
});
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;

export const participantSchema = userSchema
  .pick({ id: true, pseudo: true, avatarSeed: true })
  .extend({ joinedAt: z.iso.datetime(), teamName: z.string().nullable().default(null) });
export type Participant = z.infer<typeof participantSchema>;

export const participantsResponseSchema = z.object({
  participants: z.array(participantSchema),
});
export type ParticipantsResponse = z.infer<typeof participantsResponseSchema>;
