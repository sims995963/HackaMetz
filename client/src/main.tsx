import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { registerServiceWorker } from '@/lib/pwa';
import { applyTheme, getStoredTheme } from '@/lib/theme';
import '@/styles/globals.css';

// Thème posé avant le premier rendu pour éviter le flash clair → sombre.
applyTheme(getStoredTheme());

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
