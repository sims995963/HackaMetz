import type {
  Announcement,
  AuditEntry,
  DiscordLink,
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
import {
  announcementSchema,
  auditEntrySchema,
  discordLinkSchema,
  evaluationSchema,
  feedbackSchema,
  hackathonSchema,
  proposalRoundSchema,
  proposalVoteSchema,
  questionSchema,
  registrationSchema,
  submissionSchema,
  teamSchema,
  userSchema,
  voteSchema,
} from '@hackametz/shared';
import { z } from 'zod';
import type { UserRecord } from '../models/user.model';
import { JsonRepository } from './JsonRepository';
import type { Repository } from './Repository';

/** L'utilisateur stocké = l'utilisateur public + les empreintes de ses tokens d'appareil. */
const userRecordSchema: z.ZodType<UserRecord> = userSchema.extend({
  deviceTokenHashes: z.array(z.string()),
});

export interface Repositories {
  users: Repository<UserRecord>;
  audit: Repository<AuditEntry>;
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
  discordLinks: Repository<DiscordLink>;
}

/**
 * Une collection = un fichier JSON dans dataDir, validé par son schéma zod à l'ouverture
 * (les enregistrements illisibles sont mis de côté plutôt que de faire tomber le serveur).
 */
export function createRepositories(dataDir: string): Repositories {
  return {
    users: new JsonRepository<UserRecord>(dataDir, 'users', userRecordSchema),
    audit: new JsonRepository<AuditEntry>(dataDir, 'audit', auditEntrySchema),
    hackathons: new JsonRepository<Hackathon>(dataDir, 'hackathons', hackathonSchema),
    registrations: new JsonRepository<Registration>(dataDir, 'registrations', registrationSchema),
    submissions: new JsonRepository<Submission>(dataDir, 'submissions', submissionSchema),
    teams: new JsonRepository<Team>(dataDir, 'teams', teamSchema),
    announcements: new JsonRepository<Announcement>(dataDir, 'announcements', announcementSchema),
    evaluations: new JsonRepository<Evaluation>(dataDir, 'evaluations', evaluationSchema),
    votes: new JsonRepository<Vote>(dataDir, 'votes', voteSchema),
    proposalRounds: new JsonRepository<ProposalRound>(
      dataDir,
      'proposal-rounds',
      proposalRoundSchema,
    ),
    proposalVotes: new JsonRepository<ProposalVote>(dataDir, 'proposal-votes', proposalVoteSchema),
    questions: new JsonRepository<Question>(dataDir, 'questions', questionSchema),
    feedback: new JsonRepository<Feedback>(dataDir, 'feedback', feedbackSchema),
    discordLinks: new JsonRepository<DiscordLink>(dataDir, 'discord-links', discordLinkSchema),
  };
}

export type { Repository } from './Repository';
