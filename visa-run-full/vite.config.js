import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the full Visa Run Bingo client.
export default defineConfig({
  plugins: [react()],
  // Use a relative base so the app can be served from any subpath.
  base: './',
});
