import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@core': resolve(projectRoot, 'src/core'),
      '@scene': resolve(projectRoot, 'src/scene'),
      '@utils': resolve(projectRoot, 'src/utils'),
      '@resources': resolve(projectRoot, 'src/resources'),
      '@engine': resolve(projectRoot, 'src/engine')
    }
  },
  server: {
    host: true,
    port: 4173
  },
  preview: {
    port: 4174
  },
  test: {
    environment: 'node'
  }
});
