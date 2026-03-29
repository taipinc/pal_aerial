// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Public Sans',
      cssVariable: '--font-body',
      weights: [300, 400, 500, 600, 700],
      fallbacks: ['sans-serif'],
    },
  ],
  vite: {
    server: {
      proxy: {
        '/api/metadata.json': {
          target: 'https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev',
          changeOrigin: true,
          rewrite: (path) => '/metadata.json',
        },
        '/api/footprints.json': {
          target: 'https://pub-76d24adcec7c46aaa6f0111002b5b9d0.r2.dev',
          changeOrigin: true,
          rewrite: () => '/footprints.json',
        },
      },
    },
  },
});