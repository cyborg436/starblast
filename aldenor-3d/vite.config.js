import { defineConfig } from 'vite';

export default defineConfig({
  // chemins relatifs : le build fonctionne servi depuis n'importe quel sous-dossier
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200, // three.js est volumineux, c'est attendu
  },
});
