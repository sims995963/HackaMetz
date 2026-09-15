import { useQuery } from '@tanstack/react-query';
import { metaApi } from '@/api/meta.api';

/**
 * Décalage (ms) entre l'horloge du navigateur et celle du serveur.
 * Les comptes à rebours s'appuient dessus : l'heure du client ne fait pas foi.
 */
export function useServerOffset(): number {
  const { data } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () => {
      const before = Date.now();
      const { now } = await metaApi.time();
      const after = Date.now();
      const roundTrip = (after - before) / 2;
      return new Date(now).getTime() + roundTrip - after;
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
  return data ?? 0;
}

export function useServerNow(): () => number {
  const offset = useServerOffset();
  return () => Date.now() + offset;
}
