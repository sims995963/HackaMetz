import type { AppContext } from '../context';
import { logger } from '../utils/logger';

/**
 * Toutes les minutes : passe les hackathons « à venir » en cours, clôt les dépôts à la
 * deadline, et laisse les intégrations faire leurs fermetures programmées.
 */
export function startLifecycleJob(ctx: AppContext, intervalMs = 60_000): () => void {
  const tick = async () => {
    try {
      const changed = await ctx.services.hackathons.applyScheduledTransitions();
      for (const h of changed) logger.info({ code: h.code, status: h.status }, 'Statut mis à jour');
    } catch (err) {
      logger.error({ err }, 'Scheduler : échec de la mise à jour des statuts');
    }
    await ctx.hooks.tick();
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
