import { rateLimit } from 'express-rate-limit';
import type { ApiErrorBody } from '@hackametz/shared';

const tooMany: ApiErrorBody = {
  error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie dans quelques minutes' },
};

/** Freine la création de pseudos en rafale. */
export const enterRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: tooMany,
});
