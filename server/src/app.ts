import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, isTest } from './config/env';
import { projectRoot } from './config/paths';
import type { AppContext } from './context';
import { auditAdminActions } from './middlewares/audit';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { adminKeyRateLimit } from './middlewares/rateLimit';
import { session } from './middlewares/session';
import { apiRouter } from './routes';
import { logger } from './utils/logger';

/** Assemble l'application Express : middlewares globaux → API → front (si construit) → erreurs. */
export function createApp(ctx: AppContext): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      // L'app est souvent servie en http sur un réseau local (hackathon sur place) : sans cette
      // exception, les navigateurs tenteraient de charger les assets en https et échoueraient.
      contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (!isTest)
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  app.use(session(ctx));
  // Les mauvaises clés d'organisateur sont freinées avant d'atteindre les routes.
  app.use('/api', adminKeyRateLimit);
  app.use('/api', auditAdminActions(ctx));
  app.use('/api', apiRouter(ctx));
  app.use('/api', notFound);

  // Dès qu'un build du front existe (npm run build), Express le sert : une seule URL à partager.
  // En dev, on passe par Vite (:5173), ce build éventuel n'est alors simplement pas utilisé.
  const clientDist = resolve(projectRoot, 'client/dist');
  if (existsSync(clientDist)) {
    // Le service worker ne doit jamais être servi depuis le cache navigateur,
    // sinon une mise à jour de l'app peut rester coincée sur l'ancienne version.
    app.get('/sw.js', (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache');
      next();
    });
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(resolve(clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
