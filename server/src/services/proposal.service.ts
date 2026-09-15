import type {
  CreateProposalRoundData,
  ProposalRound,
  ProposalRoundView,
  ProposalVote,
} from '@hackametz/shared';
import { createProposalRound } from '../models/proposal.model';
import type { UserRecord } from '../models/user.model';
import type { Repositories } from '../repositories';
import { AppError } from '../utils/errors';
import { newId } from '../utils/ids';
import { nowIso } from '../utils/time';

/**
 * Tours de propositions : l'organisateur soumet trois idées de hackathon, chaque pseudo vote
 * pour une, la plus votée devient le prochain hackathon.
 */
export class ProposalService {
  constructor(private readonly repos: Repositories) {}

  /** Du plus récent au plus ancien ; les brouillons ne sont visibles que par l'admin. */
  async list(user: UserRecord | undefined, includeDrafts: boolean): Promise<ProposalRoundView[]> {
    const rounds = await this.repos.proposalRounds.all();
    const visible = rounds
      .filter((r) => includeDrafts || r.status !== 'draft')
      .sort((a, b) => b.number - a.number);
    return Promise.all(visible.map((r) => this.view(r, user)));
  }

  async get(
    id: string,
    user: UserRecord | undefined,
    includeDrafts: boolean,
  ): Promise<ProposalRoundView> {
    const round = await this.repos.proposalRounds.findById(id);
    if (!round || (!includeDrafts && round.status === 'draft'))
      throw AppError.notFound('Tour de propositions');
    return this.view(round, user);
  }

  async create(data: CreateProposalRoundData): Promise<ProposalRound> {
    const all = await this.repos.proposalRounds.all();
    const number = all.reduce((max, r) => Math.max(max, r.number), 0) + 1;
    return this.repos.proposalRounds.insert(createProposalRound(data, number));
  }

  /** Modifiable tant que le vote n'a pas commencé. */
  async update(id: string, data: CreateProposalRoundData): Promise<ProposalRound> {
    const round = await this.requireRound(id);
    if (round.status !== 'draft') throw AppError.conflict('Un tour déjà ouvert ne se modifie plus');
    return this.repos.proposalRounds.update(id, {
      title: data.title,
      description: data.description,
      proposals: data.proposals.map((p, i) => ({ ...p, id: round.proposals[i]?.id ?? newId() })),
    });
  }

  async open(id: string): Promise<ProposalRound> {
    const round = await this.requireRound(id);
    if (round.status !== 'draft') throw AppError.conflict('Ce tour est déjà ouvert ou clôturé');
    const alreadyOpen = await this.repos.proposalRounds.findOne((r) => r.status === 'open');
    if (alreadyOpen)
      throw AppError.conflict(
        `Le tour « ${alreadyOpen.title} » est encore ouvert : clôture-le d'abord`,
      );
    return this.repos.proposalRounds.update(id, { status: 'open', openedAt: nowIso() });
  }

  /** Clôture et désigne le gagnant : le plus de votes, à égalité la première proposition. */
  async close(id: string): Promise<ProposalRound> {
    const round = await this.requireRound(id);
    if (round.status !== 'open') throw AppError.conflict("Ce tour n'est pas ouvert");
    const counts = await this.counts(round);
    const winner = [...round.proposals].sort(
      (a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0),
    )[0];
    return this.repos.proposalRounds.update(id, {
      status: 'closed',
      closedAt: nowIso(),
      winnerProposalId: winner?.id ?? null,
    });
  }

  async remove(id: string): Promise<void> {
    const round = await this.requireRound(id);
    if (round.status === 'open') throw AppError.conflict('Clôture le tour avant de le supprimer');
    const votes = await this.repos.proposalVotes.filter((v) => v.roundId === id);
    for (const v of votes) await this.repos.proposalVotes.remove(v.id);
    await this.repos.proposalRounds.remove(id);
  }

  /** Un vote par pseudo et par tour ; revoter change le choix. */
  async vote(id: string, user: UserRecord, proposalId: string): Promise<ProposalRoundView> {
    const round = await this.requireRound(id);
    if (round.status !== 'open') throw AppError.conflict("Le vote n'est pas ouvert pour ce tour");
    if (!round.proposals.some((p) => p.id === proposalId)) throw AppError.notFound('Proposition');
    const existing = await this.repos.proposalVotes.findOne(
      (v) => v.roundId === id && v.userId === user.id,
    );
    if (existing) await this.repos.proposalVotes.update(existing.id, { proposalId });
    else {
      const vote: ProposalVote = {
        id: newId(),
        roundId: id,
        proposalId,
        userId: user.id,
        createdAt: nowIso(),
      };
      await this.repos.proposalVotes.insert(vote);
    }
    return this.view(await this.requireRound(id), user);
  }

  async withdraw(id: string, user: UserRecord): Promise<ProposalRoundView> {
    const round = await this.requireRound(id);
    if (round.status !== 'open') throw AppError.conflict("Le vote n'est pas ouvert pour ce tour");
    const existing = await this.repos.proposalVotes.findOne(
      (v) => v.roundId === id && v.userId === user.id,
    );
    if (existing) await this.repos.proposalVotes.remove(existing.id);
    return this.view(round, user);
  }

  /** Lie le hackathon créé à partir du gagnant. */
  async linkHackathon(roundId: string, hackathonId: string): Promise<void> {
    const round = await this.repos.proposalRounds.findById(roundId);
    if (round) await this.repos.proposalRounds.update(roundId, { hackathonId });
  }

  private async counts(round: ProposalRound): Promise<Record<string, number>> {
    const votes = await this.repos.proposalVotes.filter((v) => v.roundId === round.id);
    const counts: Record<string, number> = {};
    for (const p of round.proposals) counts[p.id] = 0;
    for (const v of votes) counts[v.proposalId] = (counts[v.proposalId] ?? 0) + 1;
    return counts;
  }

  private async view(
    round: ProposalRound,
    user: UserRecord | undefined,
  ): Promise<ProposalRoundView> {
    const counts = await this.counts(round);
    const mine = user
      ? ((
          await this.repos.proposalVotes.findOne(
            (v) => v.roundId === round.id && v.userId === user.id,
          )
        )?.proposalId ?? null)
      : null;
    return { ...round, counts, totalVotes: Object.values(counts).reduce((a, b) => a + b, 0), mine };
  }

  private async requireRound(id: string): Promise<ProposalRound> {
    const round = await this.repos.proposalRounds.findById(id);
    if (!round) throw AppError.notFound('Tour de propositions');
    return round;
  }
}
