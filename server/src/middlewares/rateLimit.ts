import { rateLimit, type Options } from 'express-rate-limit';
import type { ApiErrorBody } from '@hackametz/shared';
import { isTest } from '../config/env';

const tooMany: ApiErrorBody = {
  error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie dans quelques minutes' },
};

const minutes = (n: number) => n * 60 * 1000;

/**
 * Les limiteurs sont désactivés en test : les scénarios enchaînent volontairement
 * des dizaines d'appels, et ce n'est pas ce qu'on cherche à vérifier là.
 */
function limiter(options: Pick<Options, 'windowMs' | 'limit'> & Partial<Options>) {
  return rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: tooMany,
    ...options,
    skip: (req, res) => isTest || (options.skip?.(req, res) ?? false),
  });
}

/** Freine la création de pseudos en rafale. */
export const enterRateLimit = limiter({ windowMs: minutes(15), limit: 60 });

/**
 * Écritures courantes d'un participant (inscription, équipe, vote, question, retour).
 * Large : pendant un hackathon, une même IP peut porter toute une salle derrière un NAT.
 */
export const writeRateLimit = limiter({ windowMs: minutes(5), limit: 120 });

/** Dépôts de projet : lourds pour le serveur et le réseau, et rares par nature. */
export const uploadRateLimit = limiter({ windowMs: minutes(10), limit: 30 });

/**
 * Tentatives de clé d'organisateur : seules les mauvaises comptent, et seules
 * les requêtes qui présentent une clé sont regardées.
 */
export const adminKeyRateLimit = limiter({
  windowMs: minutes(10),
  limit: 20,
  skip: (req) => req.isAdmin === true || req.header('x-admin-key') === undefined,
});
