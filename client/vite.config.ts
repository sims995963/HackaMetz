import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Les grosses dépendances stables partent dans leurs propres chunks : le cache navigateur
    // les garde d'une version à l'autre de l'app.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          query: ['@tanstack/react-query', 'zustand'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // En dev, les appels /api partent vers Express : pas de CORS à gérer côté navigateur.
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
});
