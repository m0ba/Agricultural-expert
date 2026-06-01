<template>
  <div id="app-root">
    <div v-if="bootState.isNative && !bootState.serverReady" class="boot-overlay">
      <div class="boot-card">
        <div class="boot-spinner"></div>
        <h2>农事专家</h2>
        <p v-if="!bootState.bootFailed">
          正在启动服务...({{ bootState.attempt }}/{{ bootState.maxAttempts }})
        </p>
        <template v-else>
          <p class="boot-error">⚠️ 服务启动失败</p>
          <div class="boot-error-details" v-if="bootState.errorDetails">
            <small>错误: {{ bootState.errorDetails }}</small>
          </div>
          <p class="boot-hint">建议操作：<br/>1. 完全关闭应用后重新打开<br/>2. 检查设备存储空间（需要约200MB）<br/>3. 如果持续失败，请重新安装APK</p>
          <button @click="retryBoot" class="boot-retry-btn">🔄 重试启动</button>
        </template>
      </div>
    </div>
    <ModalDialog ref="modal" />
    <router-view />
    <nav v-if="showNav" class="bottom-nav">
      <router-link to="/" class="nav-item" :class="{ active: $route.meta.tab === 'home' }">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </router-link>
      <router-link to="/plan" class="nav-item" :class="{ active: $route.meta.tab === 'plan' }">
        <span class="nav-icon">🌱</span>
        <span class="nav-label">计划</span>
      </router-link>
      <router-link to="/record" class="nav-item" :class="{ active: $route.meta.tab === 'record' }">
        <span class="nav-icon">📝</span>
        <span class="nav-label">操作</span>
      </router-link>
      <router-link to="/data" class="nav-item" :class="{ active: $route.meta.tab === 'data' }">
        <span class="nav-icon">📊</span>
        <span class="nav-label">数据</span>
      </router-link>
      <router-link to="/knowledge" class="nav-item" :class="{ active: $route.meta.tab === 'knowledge' }">
        <span class="nav-icon">📚</span>
        <span class="nav-label">知识</span>
      </router-link>
      <router-link to="/settings" class="nav-item" :class="{ active: $route.meta.tab === 'settings' }">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import ModalDialog from './components/ModalDialog.vue';

const route = useRoute();
const showNav = computed(() => route.path !== '/setup');
const modal = ref(null);
const bootState = window.__bootState || { isNative: false, serverReady: true, bootFailed: false, attempt: 0, maxAttempts: 15, errorDetails: null };

function retryBoot() {
  if (bootState.bootFailed) {
    bootState.bootFailed = false;
    bootState.attempt = 0;
    bootState.errorDetails = null;
    window.location.reload();
  }
}

onMounted(() => {
  if (modal.value) {
    provide('modal', modal.value);
    window.__modal = modal.value;
  }
});
</script>
