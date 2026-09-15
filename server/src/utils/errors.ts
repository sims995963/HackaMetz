import type { ApiErrorCode } from '@hackametz/shared';

export interface ErrorDetail {
  path: string;
  message: string;
}

/** Erreur métier : convertie en réponse JSON par le middleware errorHandler. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(what = 'Ressource') {
    return new AppError(404, 'NOT_FOUND', `${what} introuvable`);
  }

  static unauthenticated(message = 'Identifie-toi avec ton pseudo pour continuer') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Accès réservé') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
}
