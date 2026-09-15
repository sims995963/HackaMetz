import type { User } from '@hackametz/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  user: User | null;
  /** Token d'appareil renvoyé par /auth/enter. */
  token: string | null;
  /** Clé d'organisateur (X-Admin-Key), saisie dans /admin. */
  adminKey: string | null;
  setSession: (user: User, token: string) => void;
  setUser: (user: User) => void;
  setAdminKey: (key: string | null) => void;
  clear: () => void;
}

/** Persisté dans localStorage : le pseudo survit au rechargement, l'appareil reste reconnu. */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      adminKey: null,
      setSession: (user, token) => set({ user, token }),
      setUser: (user) => set({ user }),
      setAdminKey: (adminKey) => set({ adminKey }),
      clear: () => set({ user: null, token: null }),
    }),
    { name: 'hackametz-session' },
  ),
);
