import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// npm run dev:phone: HTTPS on the LAN so a phone gets the live camera (getUserMedia needs https or localhost).
const phone = process.env.PHONE === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(phone ? [basicSsl()] : [])],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, '../shared'),
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    host: phone || undefined,
    // shared/ lives outside client/, so let the dev server read it.
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:3001' },
  },
});
