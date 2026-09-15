import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from '@/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Les toasts remontent au-dessus de la barre d'onglets mobile. */}
      <Toaster
        richColors
        closeButton
        position="bottom-right"
        offset={16}
        mobileOffset={{ bottom: 76, left: 12, right: 12 }}
        toastOptions={{
          classNames: {
            toast: 'rounded-xl border border-border/70 shadow-lift',
            title: 'font-medium',
          },
        }}
      />
    </QueryClientProvider>
  );
}
