import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors';

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(AppError.unauthenticated());
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.isAdmin) return next(AppError.forbidden("Clé d'organisateur manquante ou invalide"));
  next();
};
