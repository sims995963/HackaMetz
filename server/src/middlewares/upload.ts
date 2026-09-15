import type { RequestHandler } from 'express';
import multer from 'multer';
import type { AppContext } from '../context';
import { AppError } from '../utils/errors';

/**
 * Réception de l'archive d'un projet (champ `archive`) + métadonnées JSON (champ `meta`).
 * La limite de taille dépend du hackathon : on le résout d'abord, puis on instancie multer.
 */
export function uploadArchive(ctx: AppContext): RequestHandler {
  return async (req, res, next) => {
    try {
      const hackathon = await ctx.services.hackathons.getBySlug(
        String(req.params.slug),
        req.isAdmin,
      );
      res.locals.hackathon = hackathon;
      const upload = multer({
        storage: multer.diskStorage({ destination: await ctx.storage.tempDir() }),
        limits: {
          fileSize: hackathon.submission.maxSizeMb * 1024 * 1024,
          files: 1,
          fields: 5,
          fieldSize: 64 * 1024,
        },
        fileFilter: (_req, file, cb) => {
          if (!/\.zip$/i.test(file.originalname)) {
            cb(new AppError(400, 'VALIDATION_ERROR', 'Le dépôt doit être une archive .zip'));
            return;
          }
          cb(null, true);
        },
      });
      upload.single('archive')(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          next(
            new AppError(
              413,
              'VALIDATION_ERROR',
              `Archive trop volumineuse (maximum ${hackathon.submission.maxSizeMb} Mo)`,
            ),
          );
          return;
        }
        next(err);
      });
    } catch (err) {
      next(err);
    }
  };
}
