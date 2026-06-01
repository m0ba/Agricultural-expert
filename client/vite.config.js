import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function copyNodeJSToDist() {
  return {
    name: 'copy-nodejs-to-dist',
    closeBundle() {
      const serverDir = resolve(__dirname, '..', 'server');
      const distNodejsDir = resolve(__dirname, 'dist', 'nodejs');

      console.log('\n📦 复制服务器代码到 dist/nodejs/ (CapacitorNodeJS nodeDir)...');

      if (existsSync(distNodejsDir)) {
        rmSync(distNodejsDir, { recursive: true, force: true });
      }

      mkdirSync(distNodejsDir, { recursive: true });

      // 复制 server 目录内容到 dist/nodejs/（不是子目录）
      const items = readdirSync(serverDir);
      for (const item of items) {
        if (item !== 'node_modules' && item !== '.git') {
          const srcPath = join(serverDir, item);
          const destPath = join(distNodejsDir, item);
          cpSync(srcPath, destPath, { recursive: true });
        }
      }

      console.log('✅ 服务器代码已复制到 dist/nodejs/');
      console.log('⚠️  请运行: npm run prepare-nodejs 安装依赖\n');
    }
  };
}

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
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
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{ico,png,svg,woff2}'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
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
    }),
    copyNodeJSToDist()
  ],
  build: {
    rollupOptions: {
      // 不需要external，Capacitor原生插件由框架自动处理
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
});
