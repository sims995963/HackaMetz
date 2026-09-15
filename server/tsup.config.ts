import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  sourcemap: true,
  // Le paquet partagé est du TypeScript source : on l'embarque dans le bundle.
  noExternal: ['@hackametz/shared'],
});
