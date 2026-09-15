import type { Submission } from '@hackametz/shared';
import { SUBMISSION_STATUS_LABELS } from '@hackametz/shared';
import { ArrowRight, FileCode2, History, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { VoteButton } from '@/components/hackathon/VoteButton';
import { avatarColor, initials } from '@/lib/avatar';
import { fromNow } from '@/lib/dates';

export function SubmissionCard({
  submission: s,
  hackathonSlug,
}: {
  submission: Submission;
  hackathonSlug: string;
}) {
  const known = new Set(s.techStack.map((t) => t.toLowerCase()));
  const languages = Object.entries(s.files.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang)
    .filter((lang) => !known.has(lang.toLowerCase()))
    .slice(0, 3);

  return (
    <Link
      to={`/hackathons/${hackathonSlug}/projects/${s.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          #{String(s.number).padStart(2, '0')}
        </span>
        <div className="flex items-center gap-2">
          {s.versions.length > 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <History className="size-3.5" /> v{s.versions.length}
            </span>
          )}
          {s.status !== 'submitted' && (
            <Badge variant={s.status === 'late' ? 'warning' : 'danger'}>
              {SUBMISSION_STATUS_LABELS[s.status]}
            </Badge>
          )}
        </div>
      </div>
      <div>
        <h3 className="font-semibold leading-tight group-hover:text-primary">{s.title}</h3>
        {s.pitch && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.pitch}</p>}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: avatarColor(s.ownerId) }}
          aria-hidden
        >
          {initials(s.ownerPseudo)}
        </span>
        <span className="font-medium">{s.ownerPseudo}</span>
        {s.ownerType === 'team' && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title={s.teamMembers.join(', ')}
          >
            <Users className="size-3.5" /> {s.teamMembers.length}
          </span>
        )}
        <span className="text-muted-foreground">· {fromNow(s.updatedAt)}</span>
      </div>
      {(s.techStack.length > 0 || languages.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {s.techStack.slice(0, 4).map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
          {languages.map((l) => (
            <Badge key={l} variant="outline" className="font-normal text-muted-foreground">
              {l}
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <FileCode2 className="size-3.5" /> {s.files.fileCount} fichiers
          </span>
          <VoteButton slug={hackathonSlug} submissionId={s.id} compact />
        </span>
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  );
}
