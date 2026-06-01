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
  maxAttempts: 20,
  errorDetails: null
});

async function waitForServer() {
  const state = window.__bootState;
  for (state.attempt = 1; state.attempt <= state.maxAttempts; state.attempt++) {
    try {
      console.log(`[App] 尝试连接服务器 (${state.attempt}/${state.maxAttempts})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${SERVER_URL}/api/config`, { 
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        console.log(`[App] ✅ 服务器就绪！ (尝试 ${state.attempt} 次)`);
        console.log('[App] 服务器响应:', data);
        state.serverReady = true;
        return;
      } else {
        console.warn(`[App] 服务器返回状态码: ${res.status}`);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log(`[App] ⏱️ 连接超时 (${state.attempt}/${state.maxAttempts})`);
      } else {
        console.log(`[App] ❌ 连接失败: ${e.message} (${state.attempt}/${state.maxAttempts})`);
      }
      state.errorDetails = e.message;
    }
    
    await new Promise(r => setTimeout(r, 1500));
  }
  
  console.error('[App] 💥 服务器在所有重试后仍未响应');
  console.error('[App] 最后错误:', state.errorDetails);
  state.bootFailed = true;
}

async function boot() {
  const state = window.__bootState;
  const startTime = Date.now();

  console.log('====================================');
  console.log('🌱 农事专家 - 启动中...');
  console.log('====================================');
  console.log(`[App] 时间: ${new Date().toISOString()}`);
  console.log(`[App] Capacitor可用: ${!!window.Capacitor}`);
  console.log(`[App] 原生平台: ${window.Capacitor?.isNativePlatform?.() ?? false}`);

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.mount('#app');

  if (window.Capacitor?.isNativePlatform?.()) {
    state.isNative = true;
    console.log('\n[App] 📱 检测到原生平台，准备启动Node.js服务...\n');
    
    try {
      console.log('[App] 正在加载CapacitorNodeJS模块...');
      const { NodeJS } = await import('@choreruiz/capacitor-node-js');
      console.log('[App] ✅ 模块加载成功');
      
      console.log('[App] 启动Node.js进程...');
      console.log(`[App] 脚本路径: server/index.js`);
      console.log(`[App] 目标地址: ${SERVER_URL}`);
      
      const startResult = await NodeJS.start({ 
        script: 'server/index.js',
        options: {
          env: {
            PORT: '3000',
            NODE_ENV: 'production',
            CAPACITOR_NODE_JS: 'true'
          }
        }
      });
      
      console.log('[App] ✅ NodeJS.start() 返回:', startResult);
      console.log('[App] ⏳ 等待服务器启动...');
      
      await waitForServer();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n[App] 🎉 启动完成! 耗时: ${elapsed}s`);
      
    } catch (e) {
      console.error('\n[App] 💥 启动失败!');
      console.error('[App] 错误类型:', e.constructor.name);
      console.error('[App] 错误信息:', e.message);
      console.error('[App] 错误堆栈:', e.stack);
      state.errorDetails = `${e.constructor.name}: ${e.message}`;
      state.bootFailed = true;
    }
  } else {
    console.log('[App] 💻 Web模式，跳过Node.js启动');
    state.serverReady = true;
  }
}

boot().catch(e => {
  console.error('[App] 致命错误:', e);
  window.__bootState.bootFailed = true;
});
