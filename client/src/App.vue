<template>
  <div id="app-root">
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

// Provide modal globally
onMounted(() => {
  if (modal.value) {
    provide('modal', modal.value);
    // Also expose globally for convenience
    window.__modal = modal.value;
  }
});
</script>
