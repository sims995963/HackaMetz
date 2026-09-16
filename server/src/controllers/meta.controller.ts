import type { RequestHandler } from 'express';
import type { HealthResponse, ServerTimeResponse } from '@hackametz/shared';
import type { AppContext } from '../context';
import { nowIso } from '../utils/time';

const startedAt = Date.now();

export function healthController(ctx: AppContext) {
  const health: RequestHandler = async (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      diagnostics: await ctx.services.diagnostics.read(),
    };
    res.json(body);
  };
  return { health };
}

/** Référence des comptes à rebours côté client : l'heure du navigateur ne fait pas foi. */
export const time: RequestHandler = (_req, res) => {
  const body: ServerTimeResponse = { now: nowIso() };
  res.json(body);
};
