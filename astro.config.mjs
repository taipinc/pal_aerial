// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        '/api/metadata.json': {
          target: 'https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev',
          changeOrigin: true,
          rewrite: (path) => '/metadata.json',
        },
      },
    },
  },
});