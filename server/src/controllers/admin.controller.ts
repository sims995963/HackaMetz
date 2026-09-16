import type { RequestHandler } from 'express';
import type { AuditListResponse } from '@hackametz/shared';
import type { AppContext } from '../context';

export function adminController(ctx: AppContext) {
  const listUsers: RequestHandler = async (_req, res) => {
    const users = await ctx.services.auth.listUsers();
    res.json({ users });
  };

  /** Libère un pseudo lié à un appareil (politique device-bound). */
  const releaseUser: RequestHandler = async (req, res) => {
    const user = await ctx.services.auth.release(String(req.params.id));
    res.json({ user });
  };

  return { listUsers, releaseUser };
}

export function auditController(ctx: AppContext) {
  const list: RequestHandler = async (req, res) => {
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(req.query.limit ?? 50), 10) || 50),
    );
    const body: AuditListResponse = await ctx.services.audit.list(limit);
    res.json(body);
  };

  return { list };
}
