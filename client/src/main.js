import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

function boot() {
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  // Start Node.js backend polling in background (non-blocking)
  if (window.Capacitor?.isNativePlatform?.()) {
    pollBackend();
  }
}

async function pollBackend() {
  try {
    const { NodeJS } = await import(/* @vite-ignore */ 'capacitor-nodejs');
    console.log('[App] Capacitor NodeJS plugin loaded, waiting for backend...');
    let retries = 0;
    while (retries < 30) {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/config');
        if (res.ok) {
          console.log('[App] Backend is ready');
          return;
        }
      } catch (e) { /* server not ready yet */ }
      await new Promise(r => setTimeout(r, 1000));
      retries++;
    }
    console.error('[App] Backend failed to start within 30s');
  } catch (e) {
    console.error('[App] Failed to load capacitor-nodejs:', e);
  }
}

boot();
