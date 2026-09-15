import type { RequestHandler } from 'express';
import type { SearchResponse } from '@hackametz/shared';
import type { AppContext } from '../context';

export function searchController(ctx: AppContext) {
  const search: RequestHandler = async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const body: SearchResponse = await ctx.services.search.search(q, req.isAdmin);
    res.json(body);
  };

  return { search };
}
