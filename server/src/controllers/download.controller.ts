import type { Request, RequestHandler, Response } from 'express';
import type { Readable } from 'node:stream';
import type { AppContext } from '../context';
import { createZipStream } from '../storage/archive';
import { safeFileName, type DownloadBundle } from '../services/download.service';

/**
 * Une fois les en-têtes partis, plus rien ne peut se transformer en erreur JSON : si la
 * lecture casse, on coupe la connexion pour que le navigateur signale un fichier incomplet
 * au lieu d'enregistrer un zip tronqué. Et si le client s'en va, on cesse de compresser.
 */
function pipeToResponse(source: Readable, res: Response) {
  res.on('close', () => source.destroy());
  source.on('error', () => res.destroy());
  source.pipe(res);
}

/**
 * Téléchargements zip. Le corps part en flux : le serveur n'a jamais l'archive entière
 * en mémoire, et le navigateur écrit directement sur le disque.
 */
export function downloadController(ctx: AppContext) {
  function sendBundle(res: Response, bundle: DownloadBundle) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(bundle.fileName)}"`);
    // Taille avant compression : le navigateur affiche un ordre de grandeur, pas une jauge.
    res.setHeader('X-Uncompressed-Bytes', String(bundle.bytes));
    res.setHeader('X-File-Count', String(bundle.fileCount));

    const zip = createZipStream(bundle.entries);
    pipeToResponse(zip, res);
  }

  const project: RequestHandler = async (req, res) => {
    sendBundle(res, await ctx.services.downloads.project(String(req.params.id), req.isAdmin));
  };

  const edition: RequestHandler = async (req, res) => {
    sendBundle(res, await ctx.services.downloads.edition(String(req.params.slug), req.isAdmin));
  };

  const knowledgeBase: RequestHandler = async (req, res) => {
    sendBundle(res, await ctx.services.downloads.knowledgeBase(req.isAdmin));
  };

  const appSource: RequestHandler = async (_req: Request, res) => {
    const { fileName, stream } = await ctx.services.downloads.appSource();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(fileName)}"`);
    pipeToResponse(stream, res);
  };

  return { project, edition, knowledgeBase, appSource };
}
