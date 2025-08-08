import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the Visa Run Bingo client.
// We enable the React plugin and leave the rest of the config
// fairly simple for this demo. If you decide to host the
// application at a subpath, adjust the `base` option accordingly.
export default defineConfig({
  plugins: [react()],
  base: './',
});
