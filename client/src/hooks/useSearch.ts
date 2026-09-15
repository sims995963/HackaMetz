import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchApi } from '@/api/search.api';
import { useSession } from './useSession';

/** Retarde la valeur : on n'interroge le serveur qu'une fois la frappe posée. */
export function useDebounced<T>(value: T, delayMs = 180): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useSearch(query: string) {
  const { isAdmin } = useSession();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['search', trimmed, isAdmin],
    queryFn: () => searchApi.search(trimmed),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}
