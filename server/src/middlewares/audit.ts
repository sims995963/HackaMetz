import type { RequestHandler } from 'express';
import type { AppContext } from '../context';
import { logger } from '../utils/logger';

const READ_ONLY = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Enregistre toute action d'organisateur qui modifie quelque chose — y compris les exports.
 * Placé au niveau du routeur plutôt que dans chaque service : aucune route ne peut l'oublier.
 */
export function auditAdminActions(ctx: AppContext): RequestHandler {
  return (req, res, next) => {
    const isExport = req.method === 'GET' && req.path.includes('/exports/');
    if (!req.isAdmin || (READ_ONLY.has(req.method) && !isExport)) return next();

    res.on('finish', () => {
      // Les échecs (403, 404, validation) n'ont pas modifié l'état : inutile de les tracer.
      if (res.statusCode >= 400) return;
      void ctx.services.audit
        .record({
          actorPseudo: req.user?.pseudo ?? null,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ip: req.ip ?? null,
        })
        .catch((error) => logger.error({ error }, 'journal d’audit non écrit'));
    });
    next();
  };
}
