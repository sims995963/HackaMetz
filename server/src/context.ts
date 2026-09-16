import type { PseudoPolicy } from '@hackametz/shared';
import { EventBus } from './realtime/eventBus';
import { createRepositories, type Repositories } from './repositories';
import { AnnouncementService } from './services/announcement.service';
import { AuditService } from './services/audit.service';
import { AuthService } from './services/auth.service';
import { DiagnosticsService } from './services/diagnostics.service';
import { EvaluationService } from './services/evaluation.service';
import { ExportService } from './services/export.service';
import { FeedbackService } from './services/feedback.service';
import { KnowledgeBaseService } from './services/kb.service';
import { ProfileService } from './services/profile.service';
import { ProposalService } from './services/proposal.service';
import { QuestionService } from './services/question.service';
import { SearchService } from './services/search.service';
import { HackathonService } from './services/hackathon.service';
import { RegistrationService } from './services/registration.service';
import { SubmissionService } from './services/submission.service';
import { TeamService } from './services/team.service';
import { VoteService } from './services/vote.service';
import { HackathonStorage } from './storage/hackathon.storage';

export interface ContextOptions {
  dataDir: string;
  storageDir: string;
  adminKey: string;
  pseudoPolicy: PseudoPolicy;
}

/** Tout ce dont les routes ont besoin, construit une seule fois (et avec des dossiers temporaires dans les tests). */
export interface AppContext {
  options: ContextOptions;
  repos: Repositories;
  storage: HackathonStorage;
  events: EventBus;
  services: {
    auth: AuthService;
    hackathons: HackathonService;
    registrations: RegistrationService;
    teams: TeamService;
    submissions: SubmissionService;
    announcements: AnnouncementService;
    evaluations: EvaluationService;
    kb: KnowledgeBaseService;
    votes: VoteService;
    proposals: ProposalService;
    questions: QuestionService;
    feedback: FeedbackService;
    profile: ProfileService;
    search: SearchService;
    exports: ExportService;
    diagnostics: DiagnosticsService;
    audit: AuditService;
  };
}

export function createContext(options: ContextOptions): AppContext {
  const repos = createRepositories(options.dataDir);
  const storage = new HackathonStorage(options.storageDir);
  const events = new EventBus();
  const registrations = new RegistrationService(repos, events);
  const teams = new TeamService(repos, events);
  const votes = new VoteService(repos, events);
  const proposals = new ProposalService(repos);
  const evaluations = new EvaluationService(repos, votes);
  const feedback = new FeedbackService(repos);
  return {
    options,
    repos,
    storage,
    events,
    services: {
      auth: new AuthService(repos, options.pseudoPolicy),
      hackathons: new HackathonService(repos, storage, events, proposals),
      registrations,
      teams,
      submissions: new SubmissionService(repos, storage, registrations, teams, events),
      announcements: new AnnouncementService(repos, events),
      evaluations,
      kb: new KnowledgeBaseService(repos, storage, evaluations),
      votes,
      proposals,
      questions: new QuestionService(repos, events),
      feedback,
      profile: new ProfileService(repos, evaluations),
      search: new SearchService(repos),
      exports: new ExportService(repos, registrations, evaluations, feedback),
      diagnostics: new DiagnosticsService(options.dataDir, options.storageDir),
      audit: new AuditService(repos),
    },
  };
}
