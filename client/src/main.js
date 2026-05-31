import { createApp, reactive } from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue';
import './assets/styles.css';

const SERVER_URL = 'http://127.0.0.1:3000';

window.__bootState = reactive({
  isNative: false,
  serverReady: false,
  bootFailed: false,
  attempt: 0,
  maxAttempts: 15
});

async function waitForServer() {
  const state = window.__bootState;
  for (state.attempt = 1; state.attempt <= state.maxAttempts; state.attempt++) {
    try {
      const res = await fetch(`${SERVER_URL}/api/config`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        console.log(`[App] Server ready after ${state.attempt} attempt(s)`);
        state.serverReady = true;
        return;
      }
    } catch (e) {
      console.log(`[App] Waiting for server... attempt ${state.attempt}/${state.maxAttempts}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  console.error('[App] Server failed to respond after all retries');
  state.bootFailed = true;
}

async function boot() {
  const state = window.__bootState;

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  if (window.Capacitor?.isNativePlatform?.()) {
    state.isNative = true;
    try {
      const { NodeJS } = await import('@choreruiz/capacitor-node-js');
      await NodeJS.start({ script: 'server/index.js', options: {} });
      console.log('[App] Node.js process started, waiting for server...');
      await waitForServer();
    } catch (e) {
      console.error('[App] Failed to start Node.js:', e);
      state.bootFailed = true;
    }
  } else {
    state.serverReady = true;
  }
}

boot();
