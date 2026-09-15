import { z } from 'zod';

/** Une idée de hackathon soumise au vote. */
export const proposalSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(120),
  theme: z.string().trim().min(3, 'Au moins 3 caractères').max(200),
  description: z.string().max(5000).default(''),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  /** Couleur de couverture reprise si la proposition devient un hackathon. */
  coverColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#1E56D9'),
});
export type Proposal = z.infer<typeof proposalSchema>;

export const proposalInputSchema = proposalSchema.omit({ id: true });
export type ProposalInput = z.input<typeof proposalInputSchema>;

export const PROPOSAL_ROUND_STATUSES = ['draft', 'open', 'closed'] as const;
export type ProposalRoundStatus = (typeof PROPOSAL_ROUND_STATUSES)[number];

export const PROPOSAL_ROUND_STATUS_LABELS: Record<ProposalRoundStatus, string> = {
  draft: 'Brouillon',
  open: 'Vote ouvert',
  closed: 'Clôturé',
};

/** Nombre de propositions par tour : les participants tranchent entre trois idées. */
export const PROPOSALS_PER_ROUND = 3;

/** Un tour de vote : trois propositions, un vote par pseudo, la plus votée l'emporte. */
export const proposalRoundSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  /** Contexte donné aux votants (période visée, contraintes…). Markdown. */
  description: z.string().max(5000).default(''),
  status: z.enum(PROPOSAL_ROUND_STATUSES),
  proposals: z.array(proposalSchema).length(PROPOSALS_PER_ROUND),
  /** Renseigné à la clôture : la proposition gagnante. */
  winnerProposalId: z.string().nullable().default(null),
  /** Renseigné quand le hackathon a été créé à partir du gagnant. */
  hackathonId: z.string().nullable().default(null),
  createdAt: z.iso.datetime(),
  openedAt: z.iso.datetime().nullable().default(null),
  closedAt: z.iso.datetime().nullable().default(null),
});
export type ProposalRound = z.infer<typeof proposalRoundSchema>;

export const createProposalRoundInputSchema = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(120),
  description: z.string().max(5000).default(''),
  proposals: z
    .array(proposalInputSchema)
    .length(PROPOSALS_PER_ROUND, `Exactement ${PROPOSALS_PER_ROUND} propositions`),
});
export type CreateProposalRoundInput = z.input<typeof createProposalRoundInputSchema>;
export type CreateProposalRoundData = z.output<typeof createProposalRoundInputSchema>;

export const proposalRoundStatusInputSchema = z.object({
  status: z.enum(['open', 'closed']),
});

export const proposalVoteInputSchema = z.object({ proposalId: z.string().min(1) });

/** Ce que l'API renvoie : le tour + les compteurs + mon vote. */
export const proposalRoundViewSchema = proposalRoundSchema.extend({
  counts: z.record(z.string(), z.number().int()),
  totalVotes: z.number().int(),
  mine: z.string().nullable(),
});
export type ProposalRoundView = z.infer<typeof proposalRoundViewSchema>;

export const proposalRoundsResponseSchema = z.object({
  rounds: z.array(proposalRoundViewSchema),
});
export const proposalRoundResponseSchema = z.object({ round: proposalRoundViewSchema });

/** Vote d'un pseudo pour une proposition d'un tour. */
export const proposalVoteSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  proposalId: z.string(),
  userId: z.string(),
  createdAt: z.iso.datetime(),
});
export type ProposalVote = z.infer<typeof proposalVoteSchema>;
