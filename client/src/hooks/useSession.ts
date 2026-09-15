import { useSessionStore } from '@/store/session.store';

export function useSession() {
  const user = useSessionStore((s) => s.user);
  const token = useSessionStore((s) => s.token);
  const adminKey = useSessionStore((s) => s.adminKey);
  const clear = useSessionStore((s) => s.clear);
  return {
    user,
    token,
    isAdmin: Boolean(adminKey),
    isLoggedIn: Boolean(user && token),
    logout: clear,
  };
}
