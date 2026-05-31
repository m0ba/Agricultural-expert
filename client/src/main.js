import { createApp } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

async function boot() {
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { NodeJS } = await import('@choreruiz/capacitor-node-js');
      await NodeJS.start({ script: 'server/index.js', options: {} });
      console.log('[App] Node.js server started on device');
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error('[App] Failed to start Node.js:', e);
    }
  }

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');
}

boot();
