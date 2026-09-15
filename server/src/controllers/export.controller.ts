import type { RequestHandler } from 'express';
import type { AppContext } from '../context';
import { CSV_EXPORTS, type CsvExport } from '../services/export.service';
import { AppError } from '../utils/errors';

export function exportController(ctx: AppContext) {
  const csv: RequestHandler = async (req, res) => {
    const kind = String(req.params.kind) as CsvExport;
    if (!CSV_EXPORTS.includes(kind)) {
      throw new AppError(400, 'VALIDATION_ERROR', `Export inconnu : ${kind}`);
    }
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), true);
    const body = await ctx.services.exports.csv(hackathon, kind);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ctx.services.exports.fileName(hackathon, kind)}"`,
    );
    res.send(body);
  };

  return { csv };
}
