import type { RequestHandler } from 'express';
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
