import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

function boot() {
  // Mount Vue immediately — don't block UI
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  // Start Node.js backend in background
  if (window.Capacitor?.isNativePlatform?.()) {
    startNodeJS();
  }
}

async function startNodeJS() {
  try {
    const { NodeJS } = await import(/* @vite-ignore */ 'capacitor-nodejs');
    console.log('[App] Starting Node.js runtime...');
    
    // v1.0.0-beta.10: manual start with whenReady
    NodeJS.start({ script: 'index.js' });
    await NodeJS.whenReady();
    console.log('[App] Node.js runtime ready');

    // Poll Express server until it's up
    for (let i = 0; i < 15; i++) {
      try {
        const res = await fetch('http://127.0.0.1:3000/api/config');
        if (res.ok) { console.log('[App] Backend is ready'); return; }
      } catch (e) { /* not ready */ }
      await new Promise(r => setTimeout(r, 1000));
    }
    console.error('[App] Backend failed to start within 15s');
  } catch (e) {
    console.error('[App] Failed to start Node.js:', e);
  }
}

boot();
