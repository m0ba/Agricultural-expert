import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

function boot() {
  // Mount Vue immediately — prevents ANR
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  // Background: wait for Node.js backend (auto-started by plugin)
  if (window.Capacitor?.isNativePlatform?.()) {
    waitForBackend();
  }
}

async function waitForBackend() {
  // v0.0.1 auto-starts the Node.js runtime, no manual start needed
  // Import triggers plugin registration
  try { await import(/* @vite-ignore */ 'capacitor-nodejs'); } catch (e) {}

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/config');
      if (res.ok) { console.log('[App] Backend ready'); return; }
    } catch (e) { /* still starting */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.error('[App] Backend not ready after 30s');
}

boot();
