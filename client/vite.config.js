import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // D25: prompt-only updates. The app shows an idle action; the new SW
      // waits until the user chooses to reload.
      registerType: 'prompt',
      injectRegister: false,
      manifest: false, // public/manifest.json is the single manifest source
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/health$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Public kanji list only. Kanji detail includes user-specific
            // myProgress and must never be served from a shared cache.
            urlPattern: ({ request, url }) =>
              request.method === 'GET' &&
              url.origin === self.location.origin &&
              url.pathname === '/api/v1/kanji' &&
              (!url.searchParams.has('status') || url.searchParams.get('status') === 'all'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kanji-list',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    // Keep the app shell small and cache vendor code across route chunks.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(
              id
            )
          ) {
            return 'react-vendor';
          }
          if (/node_modules[\\/]@tanstack[\\/](react-query|query-core)[\\/]/.test(id)) {
            return 'query-vendor';
          }
          // Everything else stays route-split: a catch-all vendor chunk made
          // the login page download form/validation/chart code it never uses.
          return undefined;
        },
      },
    },
  },
});
