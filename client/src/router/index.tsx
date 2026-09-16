import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { AdminGate } from '@/components/admin/AdminGate';
import { AppShell } from '@/components/layout/AppShell';
import { BrandPage } from '@/pages/BrandPage';
import { ErrorPage } from '@/pages/ErrorPage';
import { HackathonPage } from '@/pages/HackathonPage';
import { HackathonsPage } from '@/pages/HackathonsPage';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ProposalsPage } from '@/pages/ProposalsPage';

// Les pages lourdes (viewer de code, compression, formulaire admin) ne sont chargées qu'à la demande.
const ProjectPage = lazy(() => import('@/pages/ProjectPage').then(pick('ProjectPage')));
const SubmitPage = lazy(() => import('@/pages/SubmitPage').then(pick('SubmitPage')));
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then(pick('AdminDashboardPage')),
);
const JuryPage = lazy(() => import('@/pages/JuryPage').then(pick('JuryPage')));
const ResultsPage = lazy(() => import('@/pages/ResultsPage').then(pick('ResultsPage')));
const ScreenPage = lazy(() => import('@/pages/ScreenPage').then(pick('ScreenPage')));
const CertificatePage = lazy(() => import('@/pages/CertificatePage').then(pick('CertificatePage')));
const ProposalRoundFormPage = lazy(() =>
  import('@/pages/admin/ProposalRoundFormPage').then(pick('ProposalRoundFormPage')),
);
const HackathonFormPage = lazy(() =>
  import('@/pages/admin/HackathonFormPage').then(pick('HackathonFormPage')),
);

function pick<K extends string>(name: K) {
  return <M extends Record<K, ComponentType>>(module: M) => ({ default: module[name] });
}

function Loading() {
  return <div className="h-64 animate-pulse rounded-2xl border bg-muted/60" aria-busy="true" />;
}

const lazyPage = (Page: ComponentType) => (
  <Suspense fallback={<Loading />}>
    <Page />
  </Suspense>
);

const adminPage = (Page: ComponentType) => <AdminGate>{lazyPage(Page)}</AdminGate>;

/** Une entrée par page ; l'espace organisateur est protégé par la clé admin (AdminGate). */
export const router = createBrowserRouter([
  // Le mode écran n'a ni menu ni en-tête : il vit en dehors de la coquille.
  { path: 'hackathons/:slug/ecran', element: lazyPage(ScreenPage), errorElement: <ErrorPage /> },
  {
    element: <AppShell />,
    // Sans cela, une erreur de rendu laisse une page blanche.
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'hackametz', element: <BrandPage /> },
      { path: 'hackathons', element: <HackathonsPage /> },
      { path: 'hackathons/:slug', element: <HackathonPage /> },
      { path: 'hackathons/:slug/submit', element: lazyPage(SubmitPage) },
      { path: 'hackathons/:slug/projects/:id', element: lazyPage(ProjectPage) },
      { path: 'hackathons/:slug/results', element: lazyPage(ResultsPage) },
      { path: 'jury/:slug', element: lazyPage(JuryPage) },
      { path: 'kb', element: <KnowledgeBasePage /> },
      { path: 'propositions', element: <ProposalsPage /> },
      { path: 'admin/propositions/new', element: adminPage(ProposalRoundFormPage) },
      { path: 'admin/propositions/:id/edit', element: adminPage(ProposalRoundFormPage) },
      { path: 'me', element: <ProfilePage /> },
      { path: 'me/certificat/:slug', element: lazyPage(CertificatePage) },
      { path: 'admin', element: adminPage(AdminDashboardPage) },
      { path: 'admin/hackathons/new', element: adminPage(HackathonFormPage) },
      { path: 'admin/hackathons/:slug/edit', element: adminPage(HackathonFormPage) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
