import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  // copc + laz-perf are CJS — Vite must pre-bundle them to ESM, otherwise
  // the browser hits `exports is not defined`.
  optimizeDeps: {
    include: ['copc', 'laz-perf'],
  },
});
