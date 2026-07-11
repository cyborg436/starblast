import { defineConfig } from 'vite';

export default defineConfig({
  // chemins relatifs : le build fonctionne servi depuis n'importe quel sous-dossier
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000, // three.js + rapier WASM (inline base64), attendu
  },
});
