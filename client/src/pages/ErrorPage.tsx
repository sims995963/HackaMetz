import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { Brand } from '@/components/layout/Brand';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Filet de sécurité : une erreur de rendu affichait une page blanche.
 * Ici on montre ce qui s'est passé, et les deux seules actions utiles.
 */
export function ErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Erreur inconnue';

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <Brand to="/" />
      <span
        className="inline-flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-soft"
        aria-hidden
      >
        <AlertTriangle className="size-6 text-[color:var(--brand-3)]" />
      </span>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Quelque chose a cassé</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          La page n'a pas pu s'afficher. Recharge pour réessayer ; si ça recommence, préviens
          l'organisateur avec le message ci-dessous.
        </p>
      </div>
      <p className="max-w-lg overflow-x-auto rounded-xl border border-border/70 bg-card px-4 py-3 font-mono text-xs text-muted-foreground">
        {detail}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => window.location.reload()}>
          <RotateCcw /> Recharger la page
        </Button>
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft /> Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
