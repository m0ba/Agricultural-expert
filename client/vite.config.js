import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: '农事专家 - 智能设施蔬菜种植决策系统',
        short_name: '农事专家',
        description: '面向设施蔬菜种植者的智能农事专家系统',
        theme_color: '#2d7d46',
        background_color: '#f5f7f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      },
      workbox: {
        // Only precache static assets, NOT JS/CSS — forces network-first for code
        globPatterns: ['**/*.{ico,png,svg,woff2}'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // JS/CSS: always fetch fresh from network, fall back to cache
            urlPattern: /\.(?:js|css)$/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'static-assets', expiration: { maxEntries: 50, maxAgeSeconds: 60 } }
          },
          {
            urlPattern: /\.html$/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 } }
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'weather-api', expiration: { maxEntries: 20, maxAgeSeconds: 1800 } }
          },
          {
            urlPattern: /^https:\/\/api\.bigdatacloud\.net\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'geocode-api', expiration: { maxEntries: 10, maxAgeSeconds: 300 } }
          },
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'geocode-nominatim', expiration: { maxEntries: 10, maxAgeSeconds: 300 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  build: {
    rollupOptions: {
      external: ['capacitor-plugin-nodejs']
    }
  }
});
