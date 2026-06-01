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
  maxAttempts: 30,
  errorDetails: null
});

async function waitForServer() {
  const state = window.__bootState;
  
  console.log('[App] ⏳ 等待 Node.js 服务器启动...');
  console.log(`[App] 目标地址: ${SERVER_URL}`);

  for (state.attempt = 1; state.attempt <= state.maxAttempts; state.attempt++) {
    try {
      console.log(`[App] 连接尝试 ${state.attempt}/${state.maxAttempts}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${SERVER_URL}/api/config`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        console.log(`\n[App] ✅ 服务器就绪！ (第 ${state.attempt} 次尝试)`);
        console.log('[App] 响应数据:', JSON.stringify(data).substring(0, 200));
        state.serverReady = true;
        return;
      } else {
        console.warn(`[App] ⚠️ 服务器返回 ${res.status}`);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log(`[App]   超时，继续等待...`);
      } else {
        console.log(`[App]   错误: ${e.message.substring(0, 80)}`);
      }
      state.errorDetails = e.message;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.error('\n[App] 💥 服务器未能在预期时间内启动');
  console.error('[App] 最后错误:', state.errorDetails);
  state.bootFailed = true;
}

async function boot() {
  const state = window.__bootState;
  const startTime = Date.now();

  console.log('========================================');
  console.log('🌱 农事专家 - CapacitorNodeJS 模式');
  console.log('========================================');
  console.log(`[App] 启动时间: ${new Date().toISOString()}`);
  console.log(`[App] 平台: ${window.Capacitor?.isNativePlatform?.() ? '原生' : 'Web'}`);

  // 创建并挂载 Vue 应用
  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  if (window.Capacitor?.isNativePlatform?.()) {
    state.isNative = true;

    console.log('\n[App] 📱 原生平台模式');
    console.log('[App] ℹ️  CapacitorNodeJS 配置为自动启动模式 (startMode: auto)');
    console.log('[App] ℹ️  插件将自动在 dist/nodejs/ 目录启动 Node.js');
    console.log('[App] ℹ️  等待服务器在 127.0.0.1:3000 就绪...\n');

    // 不需要手动调用 NodeJS.start()！
    // CapacitorNodeJS 会自动：
    // 1. 查找 nodeDir ('nodejs') 目录
    // 2. 读取 index.js 或 package.json 的 main
    // 3. 启动 Node.js 进程
    
    try {
      await waitForServer();
      
      if (!state.bootFailed) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n[App] 🎉 应用启动完成! 总耗时: ${elapsed}s`);
      }
    } catch (e) {
      console.error('[App] 致命错误:', e);
      state.bootFailed = true;
      state.errorDetails = e.message;
    }
  } else {
    console.log('[App] 💻 Web 开发模式');
    console.log('[App] ℹ️  需要单独启动后端: npm run dev (server目录)');
    state.serverReady = true;
  }
}

// 启动应用
boot().catch(e => {
  console.error('[App] 💥 启动失败:', e);
  window.__bootState.bootFailed = true;
});
