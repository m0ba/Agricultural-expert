import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import PlantingPlanView from './views/PlantingPlanView.vue';
import RecordView from './views/RecordView.vue';
import DataView from './views/DataView.vue';
import KnowledgeView from './views/KnowledgeView.vue';
import SettingsView from './views/SettingsView.vue';
import SetupWizard from './views/SetupWizard.vue';

const routes = [
  { path: '/', component: HomeView, meta: { tab: 'home' } },
  { path: '/plan', component: PlantingPlanView, meta: { tab: 'plan' } },
  { path: '/record', component: RecordView, meta: { tab: 'record' } },
  { path: '/data', component: DataView, meta: { tab: 'data' } },
  { path: '/knowledge', component: KnowledgeView, meta: { tab: 'knowledge' } },
  { path: '/settings', component: SettingsView, meta: { tab: 'settings' } },
  { path: '/setup', component: SetupWizard }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Guard: redirect to setup if not initialized
router.beforeEach(async (to, from, next) => {
  if (to.path === '/setup') return next();
  const bootState = window.__bootState;
  if (bootState?.isNative && !bootState.serverReady) {
    return next();
  }
  try {
    const baseUrl = window.Capacitor?.isNativePlatform?.() ? 'http://127.0.0.1:3000' : '';
    const res = await fetch(`${baseUrl}/api/config`);
    const config = await res.json();
    if (!config.initialized) return next('/setup');
  } catch (e) { /* server not running yet */ }
  next();
});

export default router;
