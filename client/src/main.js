import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

async function boot() {
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { NodeJS } = await import(/* @vite-ignore */ 'capacitor-nodejs');
      console.log('[App] Capacitor NodeJS plugin loaded, waiting for backend...');
      // Node.js runtime starts automatically (nodeDir config in capacitor.config)
      // Poll the backend until it's ready
      let retries = 0;
      while (retries < 30) {
        try {
          const res = await fetch('http://127.0.0.1:3000/api/config');
          if (res.ok) {
            console.log('[App] Backend is ready');
            break;
          }
        } catch (e) { /* server not ready yet */ }
        await new Promise(r => setTimeout(r, 1000));
        retries++;
      }
      if (retries >= 30) {
        console.error('[App] Backend failed to start within 30s');
      }
    } catch (e) {
      console.error('[App] Failed to load capacitor-nodejs:', e);
    }
  }

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
}

boot();
