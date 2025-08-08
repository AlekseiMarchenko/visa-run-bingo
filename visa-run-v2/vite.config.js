import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for Visa Run Bingo v2.
export default defineConfig({
  plugins: [react()],
  // Use a relative base path so the app can be served from any directory.
  base: './',
});
