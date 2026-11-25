import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'umami-analytics',
      apply: 'build',
      transformIndexHtml() {
        return [{
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://analytics.pepperhorn.com/script.js',
            'data-website-id': '5b879d27-e4cf-43b1-b53b-00109e64924e',
          },
          injectTo: 'head',
        }]
      },
    },
  ],
});
