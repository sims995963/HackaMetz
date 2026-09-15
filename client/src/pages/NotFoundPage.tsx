import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NotFoundPage({ what = 'Cette page' }: { what?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{what} n’existe pas</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Le lien est peut-être erroné, ou le hackathon n’est pas encore publié.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
        Retour aux hackathons
      </Link>
    </div>
  );
}
