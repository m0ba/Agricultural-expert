<template>
  <Teleport to="body">
    <!-- Confirm/Alert Dialog -->
    <div v-if="visible" class="modal-overlay" @click.self="onCancel">
      <div class="modal-dialog">
        <div class="modal-header">{{ title }}</div>
        <div class="modal-body">{{ message }}</div>
        <div class="modal-actions">
          <button v-if="showCancel" class="btn btn-outline" @click="onCancel">取消</button>
          <button class="btn btn-primary" @click="onConfirm">确认</button>
        </div>
      </div>
    </div>

    <!-- Prompt Dialog -->
    <div v-if="promptVisible" class="modal-overlay" @click.self="onPromptCancel">
      <div class="modal-dialog">
        <div class="modal-header">{{ promptTitle }}</div>
        <div class="modal-body">
          <p>{{ promptMessage }}</p>
          <select v-if="promptOptions.length" v-model="promptValue" class="form-select">
            <option v-for="opt in promptOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input v-else v-model="promptValue" class="form-input" :placeholder="promptPlaceholder" />
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="onPromptCancel">取消</button>
          <button class="btn btn-primary" @click="onPromptConfirm">确认</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toastVisible" class="toast-notification" :class="toastType">
      {{ toastMessage }}
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue';

// Confirm/Alert state
const visible = ref(false);
const title = ref('');
const message = ref('');
const showCancel = ref(true);
let resolveConfirm = null;

// Prompt state
const promptVisible = ref(false);
const promptTitle = ref('');
const promptMessage = ref('');
const promptValue = ref('');
const promptPlaceholder = ref('');
const promptOptions = ref([]);
let resolvePrompt = null;

// Toast state
const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref('info');
let toastTimer = null;

// Confirm dialog
function showConfirm(msg, t = '确认') {
  title.value = t;
  message.value = msg;
  showCancel.value = true;
  visible.value = true;
  return new Promise(resolve => { resolveConfirm = resolve; });
}

// Alert dialog
function showAlert(msg, t = '提示') {
  title.value = t;
  message.value = msg;
  showCancel.value = false;
  visible.value = true;
  return new Promise(resolve => { resolveConfirm = resolve; });
}

// Prompt dialog
function showPrompt(msg, t = '输入', opts = {}, options = []) {
  promptTitle.value = t;
  promptMessage.value = msg;
  promptValue.value = opts.default || '';
  promptPlaceholder.value = opts.placeholder || '';
  promptOptions.value = options;
  promptVisible.value = true;
  return new Promise(resolve => { resolvePrompt = resolve; });
}

// Toast notification
function showToast(msg, type = 'info', duration = 3000) {
  toastMessage.value = msg;
  toastType.value = type;
  toastVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, duration);
}

function onConfirm() {
  visible.value = false;
  if (resolveConfirm) resolveConfirm(true);
}

function onCancel() {
  visible.value = false;
  if (resolveConfirm) resolveConfirm(false);
}

function onPromptConfirm() {
  promptVisible.value = false;
  if (resolvePrompt) resolvePrompt(promptValue.value);
}

function onPromptCancel() {
  promptVisible.value = false;
  if (resolvePrompt) resolvePrompt(null);
}

defineExpose({ showConfirm, showAlert, showPrompt, showToast });
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.modal-dialog {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 360px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
}

.modal-body {
  font-size: 14px;
  color: var(--text);
  margin-bottom: 20px;
  line-height: 1.6;
}

.modal-body p { margin-bottom: 8px; }

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.toast-notification {
  position: fixed;
  bottom: 80px;
  right: 16px;
  left: 16px;
  max-width: 360px;
  margin-left: auto;
  padding: 14px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  z-index: 99999;
  box-shadow: 0 4px 20px rgba(0,0,0,0.18);
  animation: toast-slide-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
  line-height: 1.5;
}

.toast-notification.info { background: #323232; color: white; }
.toast-notification.success { background: var(--success); color: white; }
.toast-notification.error { background: var(--danger); color: white; }

@keyframes toast-slide-in {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
