import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import { useSession } from './useSession';

/** Profil détaillé (inscriptions, projets) — seulement quand un token est présent. */
export function useMe() {
  const { isLoggedIn } = useSession();
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    enabled: isLoggedIn,
    staleTime: 15_000,
    retry: false,
  });
}
