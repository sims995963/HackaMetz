import type {
  Announcement,
  Evaluation,
  Feedback,
  Hackathon,
  ProposalRound,
  ProposalVote,
  Question,
  Registration,
  Submission,
  Team,
  Vote,
} from '@hackametz/shared';
import type { UserRecord } from '../models/user.model';
import { JsonRepository } from './JsonRepository';
import type { Repository } from './Repository';

export interface Repositories {
  users: Repository<UserRecord>;
  hackathons: Repository<Hackathon>;
  registrations: Repository<Registration>;
  submissions: Repository<Submission>;
  teams: Repository<Team>;
  announcements: Repository<Announcement>;
  evaluations: Repository<Evaluation>;
  votes: Repository<Vote>;
  proposalRounds: Repository<ProposalRound>;
  proposalVotes: Repository<ProposalVote>;
  questions: Repository<Question>;
  feedback: Repository<Feedback>;
}

/** Une collection = un fichier JSON dans dataDir. */
export function createRepositories(dataDir: string): Repositories {
  return {
    users: new JsonRepository<UserRecord>(dataDir, 'users'),
    hackathons: new JsonRepository<Hackathon>(dataDir, 'hackathons'),
    registrations: new JsonRepository<Registration>(dataDir, 'registrations'),
    submissions: new JsonRepository<Submission>(dataDir, 'submissions'),
    teams: new JsonRepository<Team>(dataDir, 'teams'),
    announcements: new JsonRepository<Announcement>(dataDir, 'announcements'),
    evaluations: new JsonRepository<Evaluation>(dataDir, 'evaluations'),
    votes: new JsonRepository<Vote>(dataDir, 'votes'),
    proposalRounds: new JsonRepository<ProposalRound>(dataDir, 'proposal-rounds'),
    proposalVotes: new JsonRepository<ProposalVote>(dataDir, 'proposal-votes'),
    questions: new JsonRepository<Question>(dataDir, 'questions'),
    feedback: new JsonRepository<Feedback>(dataDir, 'feedback'),
  };
}

export type { Repository } from './Repository';
