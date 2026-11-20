import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths: the desktop app loads dist/index.html from disk.
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
