import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@hackametz/shared';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const notFound: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} inconnue` },
  };
  res.status(404).json(body);
};

/** Point de sortie unique des erreurs : toujours le même format JSON. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof ZodError) {
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: err.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof multer.MulterError) {
    const body: ApiErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: `Upload refusé : ${err.message}` },
    };
    res.status(400).json(body);
    return;
  }

  // Body JSON mal formé (express.json)
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    const body: ApiErrorBody = { error: { code: 'VALIDATION_ERROR', message: 'JSON invalide' } };
    res.status(400).json(body);
    return;
  }

  logger.error({ err }, 'Erreur non gérée');
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Erreur interne, réessaie dans un instant' },
  };
  res.status(500).json(body);
};
