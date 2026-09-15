import type { RequestHandler } from 'express';
import type { AppContext } from '../context';

const HEARTBEAT_MS = 25_000;

/**
 * Flux Server-Sent Events d'un hackathon : le navigateur reçoit annonces, inscriptions,
 * dépôts et changements de statut sans recharger. Un commentaire « ping » garde la connexion ouverte.
 */
export function hackathonEvents(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const hackathon = await ctx.services.hackathons.getBySlug(String(req.params.slug), req.isAdmin);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');

    const unsubscribe = ctx.events.subscribe(hackathon.slug, (event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  };
}
