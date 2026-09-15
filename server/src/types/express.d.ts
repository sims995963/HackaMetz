import type { UserRecord } from '../models/user.model';

declare global {
  namespace Express {
    interface Request {
      /** Utilisateur identifié par son token d'appareil (middleware session). */
      user?: UserRecord;
      /** Vrai si le header X-Admin-Key est valide (middleware session). */
      isAdmin: boolean;
    }
  }
}

export {};
