/** Enregistrement du service worker : uniquement sur le build de production, jamais en dev. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Pas de service worker (http non sécurisé sur une IP, navigateur restrictif) : l'app marche quand même.
    });
  });
}
