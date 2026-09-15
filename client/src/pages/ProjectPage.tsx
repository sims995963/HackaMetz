import { useState } from 'react';
import type { FileNode } from '@hackametz/shared';
import { SUBMISSION_STATUS_LABELS } from '@hackametz/shared';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  History,
  Ban,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { Avatar } from '@/components/session/Avatar';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submissionsApi } from '@/api/submissions.api';
import { Button } from '@/components/ui/button';
import { useHackathon } from '@/hooks/useHackathons';
import { useSession } from '@/hooks/useSession';
import { useSubmission, useSubmissionFile, useSubmissionTree } from '@/hooks/useParticipation';
import { formatDateTime } from '@/lib/dates';
import { CodeView } from '@/components/code/CodeView';
import { VoteButton } from '@/components/hackathon/VoteButton';
import { formatBytes } from '@/lib/project-files';
import { cn } from '@/lib/utils';
import { Markdown } from '@/components/markdown/Markdown';
import { NotFoundPage } from './NotFoundPage';

export function ProjectPage() {
  const { slug = '', id = '' } = useParams();
  const { data: s, isPending, isError, error } = useSubmission(id);
  const { isAdmin } = useSession();
  const queryClient = useQueryClient();
  const setStatus = useMutation({
    mutationFn: (status: 'submitted' | 'disqualified') => submissionsApi.setStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['submission', id] });
      void queryClient.invalidateQueries({ queryKey: ['submissions', slug] });
      void queryClient.invalidateQueries({ queryKey: ['results', slug] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Action impossible'),
  });
  const { data: tree } = useSubmissionTree(id);
  const { data: hackathon } = useHackathon(slug);
  const [selected, setSelected] = useState<string | null>(null);

  const readmeName =
    tree?.tree.children?.find(
      (n) => n.type === 'file' && /^readme(\.md|\.txt|\.rst)?$/i.test(n.name),
    )?.path ?? null;
  const currentPath = selected ?? readmeName;
  const { data: file, isPending: fileLoading } = useSubmissionFile(id, currentPath);

  if (isPending)
    return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="Ce projet" />;
    return <p className="text-destructive">{error.message}</p>;
  }

  const languages = Object.entries(s.files.languages).sort((a, b) => b[1] - a[1]);

  return (
    <article className="flex flex-col gap-6">
      <Link
        to={`/hackathons/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Retour au hackathon
      </Link>

      <header className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-soft">
        <div
          className="h-1.5"
          style={{
            background: hackathon
              ? `linear-gradient(90deg, ${hackathon.coverColor}, color-mix(in oklab, ${hackathon.coverColor} 50%, var(--brand-2)))`
              : 'var(--gradient-brand)',
          }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-4 top-4 select-none font-mono text-[7rem] font-bold leading-none text-foreground/[0.035]"
          aria-hidden
        >
          {String(s.number).padStart(2, '0')}
        </span>
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            {hackathon && (
              <Link
                to={`/hackathons/${slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-medium transition-colors hover:border-border hover:bg-card"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: hackathon.coverColor }}
                  aria-hidden
                />
                #{hackathon.code} {hackathon.title}
              </Link>
            )}
            <span className="font-mono text-sm text-muted-foreground">
              projet #{String(s.number).padStart(2, '0')}
            </span>
            {s.status !== 'submitted' && (
              <Badge variant={s.status === 'late' ? 'warning' : 'danger'}>
                {SUBMISSION_STATUS_LABELS[s.status]}
              </Badge>
            )}
            {s.versions.length > 1 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <History className="size-3.5" /> version {s.versions.length}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{s.title}</h1>
          {s.pitch && <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{s.pitch}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <Avatar
                user={{ pseudo: s.ownerPseudo, avatarSeed: s.ownerId }}
                className="size-7 text-[10px]"
              />
              <span className="font-medium">{s.ownerPseudo}</span>
            </span>
            {s.ownerType === 'team' && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4" /> {s.teamMembers.join(', ')}
              </span>
            )}
            <span className="text-muted-foreground">déposé le {formatDateTime(s.submittedAt)}</span>
            <VoteButton slug={slug} submissionId={s.id} />
            {s.repoUrl && <ExtLink href={s.repoUrl} label="Dépôt Git" />}
            {s.demoUrl && <ExtLink href={s.demoUrl} label="Démo" />}
            {s.videoUrl && <ExtLink href={s.videoUrl} label="Vidéo" />}
          </div>

          {(s.techStack.length > 0 || languages.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {s.techStack.map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">
                  {t}
                </Badge>
              ))}
              {languages.map(([lang, count]) => (
                <Badge key={lang} variant="outline" className="font-normal text-muted-foreground">
                  {lang} <span className="font-mono">×{count}</span>
                </Badge>
              ))}
            </div>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt>Fichiers</dt>
              <dd className="font-mono text-sm text-foreground">{s.files.fileCount}</dd>
            </div>
            <div>
              <dt>Taille du code</dt>
              <dd className="font-mono text-sm text-foreground">
                {formatBytes(s.files.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt>Exclus à l’extraction</dt>
              <dd className="font-mono text-sm text-foreground">{s.files.skippedCount}</dd>
            </div>
            <div className="min-w-0">
              <dt className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5" /> SHA-256
              </dt>
              <dd className="truncate font-mono text-sm text-foreground" title={s.files.sha256}>
                {s.files.sha256.slice(0, 12)}…
              </dd>
            </div>
          </dl>
          <p className="mt-3 font-mono text-xs text-muted-foreground">{s.files.sourcePath}</p>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <span className="text-muted-foreground">Organisateur :</span>
              {s.status === 'disqualified' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate('submitted')}
                >
                  <RotateCcw /> Rétablir le projet
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate('disqualified')}
                >
                  <Ban /> Disqualifier
                </Button>
              )}
            </div>
          )}
          {s.files.warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-warning">
                <ShieldAlert className="size-4" /> Secrets probables détectés — à retirer avant
                publication
              </p>
              <ul className="mt-1 list-disc pl-6 font-mono text-xs text-warning">
                {s.files.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-border/70 bg-card p-3 shadow-soft lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Fichiers
          </p>
          {tree ? (
            <>
              <Tree
                nodes={tree.tree.children ?? []}
                selected={currentPath}
                onSelect={setSelected}
              />
              {tree.truncated && (
                <p className="mt-2 px-2 text-xs text-warning">Arbre tronqué : trop de fichiers.</p>
              )}
            </>
          ) : (
            <div className="h-40 animate-pulse rounded-md bg-muted/60" />
          )}
        </aside>

        <section className="min-w-0 rounded-xl border bg-card">
          {currentPath ? (
            <>
              <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
                {/\.md$/i.test(currentPath) ? (
                  <FileText className="size-4 text-muted-foreground" />
                ) : (
                  <FileCode2 className="size-4 text-muted-foreground" />
                )}
                <span className="font-mono">{currentPath}</span>
                {file && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>
              {fileLoading && <div className="h-40 animate-pulse bg-muted/40" />}
              {file && file.binary && (
                <p className="p-6 text-sm text-muted-foreground">Fichier binaire, pas d’aperçu.</p>
              )}
              {file && !file.binary && /\.md$/i.test(currentPath) && (
                <div className="p-5">
                  <Markdown>{file.content}</Markdown>
                </div>
              )}
              {file && !file.binary && !/\.md$/i.test(currentPath) && (
                <div className="p-2">
                  <CodeView code={file.content} path={currentPath} />
                </div>
              )}
              {file?.truncated && (
                <p className="border-t px-4 py-2 text-xs text-warning">
                  Aperçu limité aux premiers 256 Ko.
                </p>
              )}
            </>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Choisis un fichier pour l’afficher.</p>
          )}
        </section>
      </div>
    </article>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {label} <ExternalLink className="size-3.5" />
    </a>
  );
}

function Tree({
  nodes,
  selected,
  onSelect,
  depth = 0,
}: {
  nodes: FileNode[];
  selected: string | null;
  onSelect: (p: string) => void;
  depth?: number;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          selected={selected}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function TreeNode({
  node,
  selected,
  onSelect,
  depth,
}: {
  node: FileNode;
  selected: string | null;
  onSelect: (p: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const padding = { paddingLeft: `${8 + depth * 14}px` };

  if (node.type === 'dir') {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={padding}
          className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-accent"
        >
          {open ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
          {open ? (
            <FolderOpen className="size-4 text-[color:var(--brand-3)]" />
          ) : (
            <Folder className="size-4 text-[color:var(--brand-3)]" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <Tree nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
        )}
      </li>
    );
  }
  const active = selected === node.path;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        style={padding}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-accent',
          active && 'bg-accent font-medium text-accent-foreground',
        )}
      >
        <span className="size-3.5" />
        <FileCode2 className="size-4 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
