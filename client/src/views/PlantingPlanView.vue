<template>
  <div class="page plan-page">
    <div class="plan-header">
      <div class="header-content">
        <h1 class="page-title">
          <span class="title-icon">🌱</span>
          种植计划
        </h1>
        <p class="page-subtitle">AI 智能生成全生育期种植方案</p>
      </div>
    </div>

    <div v-if="!aiEnabled" class="card ai-disabled-card">
      <div class="ai-disabled-icon">⚙️</div>
      <div class="ai-disabled-text">
        <h3>AI 功能未启用</h3>
        <p>请先在设置中启用并配置 AI 接口</p>
      </div>
      <router-link to="/settings" class="btn btn-accent">前往设置</router-link>
    </div>

    <div v-else class="plan-body">
      <div v-if="activeCrops.length > 1 || selectedCrop" class="card crop-select-info-card">
        <div v-if="activeCrops.length > 1" class="crop-chips-row" :class="{ 'scrollable': activeCrops.length >= 4 }">
          <button
            v-for="crop in activeCrops"
            :key="crop.id"
            class="crop-chip"
            :class="{ active: selectedCropId === crop.id }"
            @click="selectCrop(crop.id)"
          >
            <span class="chip-icon">{{ getCropIcon(crop.type) }}</span>
            <span class="chip-label">{{ crop.type }} · {{ crop.variety_name }}</span>
          </button>
        </div>
        <div v-if="selectedCrop" class="crop-info-row">
          <span class="crop-info-icon">{{ getCropIcon(selectedCrop.type) }}</span>
          <span class="crop-info-name">{{ selectedCrop.type }} · {{ selectedCrop.variety_name }}</span>
          <span v-if="selectedCrop.greenhouse_name" class="crop-info-greenhouse">{{ selectedCrop.greenhouse_name }}</span>
          <div class="crop-meta-inline">
            <span class="meta-tag">{{ selectedCrop.current_stage }}</span>
            <span class="meta-tag">{{ daysAfterTransplant }}天</span>
          </div>
          <button
            v-if="!hasPlanData"
            class="btn-inline btn-gen"
            :disabled="planGenerating || cooldownRemaining > 0"
            @click="generatePlan"
          >
            <span v-if="planGenerating" class="btn-loading"></span>
            <span v-else>🤖</span>
            {{ planGenerating ? '生成中...' : '生成计划' }}
          </button>
          <button
            v-else
            class="btn-inline btn-regen"
            :disabled="planGenerating || cooldownRemaining > 0"
            @click="generatePlan"
          >
            <span v-if="planGenerating" class="btn-loading"></span>
            <span v-else>🔄</span>
            {{ planGenerating ? '生成中...' : (cooldownRemaining > 0 ? formatCooldown(cooldownRemaining) : '重新生成') }}
          </button>
          <div v-if="planTimestamp && hasPlanData" class="update-badge-row">
            更新于 {{ planTimestamp }}
          </div>
        </div>
      </div>

      <div v-if="planGenerating" class="loading-state-card">
        <div class="loading-animation">
          <div class="loading-spinner"></div>
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
        <h3 class="loading-title">AI 正在分析...</h3>
        <p class="loading-description">正在综合分析作物特性、环境条件和天气数据</p>
      </div>

      <div v-if="!hasPlanData && !planGenerating" class="empty-state-card">
        <div class="empty-icon-large">📋</div>
        <h3 class="empty-title">暂无种植计划</h3>
        <p class="empty-description">点击上方按钮，AI 将为您生成个性化种植方案</p>
      </div>

      <div v-if="hasPlanData && !planGenerating" class="plan-result-section">

        <!-- 总览卡片 -->
        <div v-if="planOverview" class="card overview-card">
          <div class="overview-header">
            <div class="overview-title-row">
              <span class="overview-icon">{{ getCropIcon(selectedCrop?.type) }}</span>
              <h2 class="overview-crop-name">{{ planOverview.crop }}</h2>
              <span v-if="selectedCrop?.greenhouse_name" class="overview-greenhouse">{{ selectedCrop.greenhouse_name }}</span>
            </div>
            <div class="overview-progress-bar">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: planOverview.overall_progress || '0%' }"></div>
              </div>
              <span class="progress-text">{{ planOverview.overall_progress || '0%' }}</span>
            </div>
          </div>
          <div class="overview-stats">
            <div class="stat-item">
              <div class="stat-value">{{ planOverview.days_after_planting || 0 }}</div>
              <div class="stat-label">已种植(天)</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ planOverview.days_remaining || 0 }}</div>
              <div class="stat-label">剩余(天)</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ planOverview.total_days || 0 }}</div>
              <div class="stat-label">总天数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value harvest">{{ formatShortDate(planOverview.expected_harvest) }}</div>
              <div class="stat-label">预计采收</div>
            </div>
          </div>
          <div v-if="planOverview.current_day_in_stage" class="overview-stage-info">
            <span class="stage-badge">{{ planOverview.current_stage }}</span>
            <span class="stage-day">{{ planOverview.current_day_in_stage }}</span>
          </div>
        </div>

        <!-- 倒计时提醒 -->
        <div v-if="upcomingEvents.length > 0" class="card countdown-card">
          <h3 class="card-title countdown-title">
            <span class="title-emoji">⏰</span> 即将到来
          </h3>
          <div class="countdown-list">
            <div
              v-for="(event, i) in upcomingEvents"
              :key="i"
              class="countdown-item"
              :class="'urgency-' + (event.urgency || '规划')"
            >
              <div class="countdown-days-badge">
                <span class="days-number">{{ event.days_until }}</span>
                <span class="days-unit">天后</span>
              </div>
              <div class="countdown-content">
                <div class="countdown-event">
                  <span class="event-icon">{{ event.icon || '📌' }}</span>
                  {{ event.event }}
                </div>
                <div class="countdown-action">{{ event.action }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 横向生长时间轴 -->
        <div v-if="milestones.length > 0" class="card timeline-card">
          <h3 class="card-title">
            <span class="title-emoji">📅</span> 生长时间轴
          </h3>
          <div class="h-timeline-wrapper">
            <div class="h-timeline-scroll">
              <div class="h-timeline-line"></div>
              <div
                v-for="(ms, i) in milestones"
                :key="i"
                class="h-timeline-node"
                :class="'status-' + (ms.status || '未开始')"
              >
                <div class="h-node-dot">
                  <span v-if="ms.status === '已完成'" class="dot-check">✓</span>
                  <span v-else-if="ms.status === '进行中'" class="dot-pulse"></span>
                  <span v-else class="dot-empty"></span>
                </div>
                <div class="h-node-label">{{ ms.stage }}</div>
                <div class="h-node-date">{{ formatShortDate(ms.start_date) }}</div>
                <div class="h-node-duration">{{ ms.duration }}</div>
                <div v-if="ms.status === '进行中' && ms.current_day" class="h-node-current">
                  第{{ ms.current_day }}天
                </div>
                <div class="h-node-event">{{ ms.key_event }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 环境建议 -->
        <div v-if="envAdvice" class="card env-card">
          <h3 class="card-title">
            <span class="title-emoji">🌡️</span> 今日环境建议
          </h3>
          <div v-if="envAdvice.current_weather" class="env-weather-row">
            <div class="weather-main">
              <span class="weather-temp">{{ envAdvice.current_weather.temperature }}</span>
              <span class="weather-desc">{{ envAdvice.current_weather.weather_desc }}</span>
            </div>
            <div class="weather-humidity">湿度 {{ envAdvice.current_weather.humidity }}</div>
          </div>
          <div v-if="envAdvice.current_weather?.forecast_7days" class="env-forecast">
            📊 {{ envAdvice.current_weather.forecast_7days }}
          </div>
          <div v-if="envAdvice.greenhouse_control" class="env-controls">
            <div v-if="envAdvice.greenhouse_control.temperature" class="env-control-item" :class="'status-' + getControlClass(envAdvice.greenhouse_control.temperature.status)">
              <div class="control-icon">🌡️</div>
              <div class="control-info">
                <div class="control-title">温度管理</div>
                <div class="control-detail">
                  目标: {{ envAdvice.greenhouse_control.temperature.target_day }}(日) / {{ envAdvice.greenhouse_control.temperature.target_night }}(夜)
                </div>
                <div class="control-action">{{ envAdvice.greenhouse_control.temperature.action }}</div>
              </div>
              <div class="control-status-tag">{{ envAdvice.greenhouse_control.temperature.status }}</div>
            </div>
            <div v-if="envAdvice.greenhouse_control.ventilation" class="env-control-item" :class="'status-' + getControlClass(envAdvice.greenhouse_control.ventilation.status)">
              <div class="control-icon">💨</div>
              <div class="control-info">
                <div class="control-title">通风管理</div>
                <div class="control-detail">{{ envAdvice.greenhouse_control.ventilation.reason }}</div>
                <div class="control-action">{{ envAdvice.greenhouse_control.ventilation.action }}</div>
              </div>
              <div class="control-status-tag">{{ envAdvice.greenhouse_control.ventilation.status }}</div>
            </div>
            <div v-if="envAdvice.greenhouse_control.watering" class="env-control-item" :class="'status-' + getControlClass(envAdvice.greenhouse_control.watering.status)">
              <div class="control-icon">💧</div>
              <div class="control-info">
                <div class="control-title">浇水管理</div>
                <div class="control-detail">{{ envAdvice.greenhouse_control.watering.reason }}</div>
                <div class="control-action">{{ envAdvice.greenhouse_control.watering.action }}</div>
              </div>
              <div class="control-status-tag">{{ envAdvice.greenhouse_control.watering.status }}</div>
            </div>
            <div v-if="envAdvice.greenhouse_control.humidity" class="env-control-item" :class="'status-' + getControlClass(envAdvice.greenhouse_control.humidity.status)">
              <div class="control-icon">💦</div>
              <div class="control-info">
                <div class="control-title">湿度管理</div>
                <div class="control-detail">目标: {{ envAdvice.greenhouse_control.humidity.target }}</div>
                <div class="control-action">{{ envAdvice.greenhouse_control.humidity.action }}</div>
              </div>
              <div class="control-status-tag">{{ envAdvice.greenhouse_control.humidity.status }}</div>
            </div>
          </div>
        </div>

        <!-- 今日任务 -->
        <div v-if="stageGuide && stageGuide.today_tasks?.length > 0" class="card today-tasks-card">
          <h3 class="card-title">
            <span class="title-emoji">📋</span> 今日任务
            <span class="task-stage-info">{{ stageGuide.stage_name }} · 第{{ stageGuide.day_in_stage }}天</span>
          </h3>
          <div class="tasks-list">
            <div v-for="(task, i) in stageGuide.today_tasks" :key="i" class="task-item" :class="'importance-' + (task.importance || '建议')">
              <div class="task-icon">{{ task.icon || '📌' }}</div>
              <div class="task-content">
                <div class="task-name">{{ task.task }}</div>
                <div class="task-meta">
                  <span class="task-time">🕐 {{ task.time }}</span>
                  <span class="task-importance-tag">{{ task.importance }}</span>
                </div>
                <div class="task-method">{{ task.method }}</div>
              </div>
            </div>
          </div>
          <div v-if="stageGuide.this_week_tasks?.length > 0" class="week-tasks">
            <h4 class="week-title">📌 本周任务</h4>
            <ul class="week-list">
              <li v-for="(task, i) in stageGuide.this_week_tasks" :key="i">{{ task }}</li>
            </ul>
          </div>
          <div v-if="stageGuide.watch_points?.length > 0" class="watch-points">
            <h4 class="watch-title">⚠️ 注意事项</h4>
            <ul class="watch-list">
              <li v-for="(point, i) in stageGuide.watch_points" :key="i">{{ point }}</li>
            </ul>
          </div>
        </div>

        <!-- 下一阶段预告 -->
        <div v-if="nextPreview" class="card next-stage-card">
          <h3 class="card-title">
            <span class="title-emoji">🔮</span> 下一阶段预告
            <span v-if="nextPreview.days_until" class="next-stage-countdown">还有{{ nextPreview.days_until }}天</span>
          </h3>
          <div class="next-stage-header">
            <h4 class="next-stage-name">{{ nextPreview.stage_name }}</h4>
            <span class="next-stage-date">预计 {{ formatShortDate(nextPreview.expected_start) }} 开始</span>
          </div>
          <div v-if="nextPreview.key_events?.length > 0" class="next-events">
            <h5 class="sub-title">🔑 关键事件</h5>
            <ul class="sub-list">
              <li v-for="(e, i) in nextPreview.key_events" :key="i">{{ e }}</li>
            </ul>
          </div>
          <div v-if="nextPreview.preparation?.length > 0" class="next-prep">
            <h5 class="sub-title">📦 准备工作</h5>
            <ul class="sub-list">
              <li v-for="(p, i) in nextPreview.preparation" :key="i">{{ p }}</li>
            </ul>
          </div>
          <div v-if="nextPreview.pollination_guide" class="pollination-guide">
            <h5 class="sub-title">🐝 授粉指南</h5>
            <div class="pollination-info">
              <div class="poll-row"><span class="poll-label">方式：</span>{{ nextPreview.pollination_guide.method }}</div>
              <div class="poll-row"><span class="poll-label">最佳时间：</span>{{ nextPreview.pollination_guide.best_time }}</div>
              <div class="poll-row"><span class="poll-label">频率：</span>{{ nextPreview.pollination_guide.frequency }}</div>
            </div>
            <div v-if="nextPreview.pollination_guide.tips?.length > 0" class="poll-tips">
              <div v-for="(tip, i) in nextPreview.pollination_guide.tips" :key="i" class="poll-tip-item">
                💡 {{ tip }}
              </div>
            </div>
          </div>
        </div>

        <!-- 病虫害防治 -->
        <div v-if="pestCalendar" class="card pest-card">
          <h3 class="card-title">
            <span class="title-emoji">🛡️</span> 病虫害防治
          </h3>

          <div v-if="pestCalendar.current_risk?.length > 0" class="pest-section">
            <h4 class="pest-subtitle">⚠️ 当前风险</h4>
            <div v-for="(risk, i) in pestCalendar.current_risk" :key="'cr-'+i" class="pest-risk-item" :class="'risk-' + (risk.risk_level || '低')">
              <div class="pest-risk-header">
                <span class="pest-risk-name">{{ risk.name }}</span>
                <span class="pest-risk-badge">{{ risk.risk_level }}风险</span>
                <span v-if="risk.days_until_high_risk_end != null" class="pest-countdown">还有{{ risk.days_until_high_risk_end }}天高风险期结束</span>
              </div>
              <div v-if="risk.symptoms" class="pest-symptoms">症状：{{ risk.symptoms }}</div>
              <div v-if="risk.prevention?.length > 0" class="pest-prevention">
                <span class="pest-prevention-label">预防：</span>{{ risk.prevention.join('；') }}
              </div>
              <div v-if="risk.treatment" class="pest-treatment">
                <span class="pest-treatment-label">治疗：</span>{{ risk.treatment }}
              </div>
            </div>
          </div>

          <div v-if="pestCalendar.upcoming_risks?.length > 0" class="pest-section">
            <h4 class="pest-subtitle">🔜 即将到来的风险</h4>
            <div v-for="(risk, i) in pestCalendar.upcoming_risks" :key="'ur-'+i" class="pest-upcoming-item">
              <div class="pest-upcoming-header">
                <span class="pest-upcoming-name">{{ risk.name }}</span>
                <span class="pest-upcoming-countdown">还有{{ risk.days_until }}天</span>
              </div>
              <div class="pest-upcoming-trigger">触发条件：{{ risk.trigger }}</div>
              <div v-if="risk.prevention?.length > 0" class="pest-upcoming-prevention">
                预防：{{ risk.prevention.join('；') }}
              </div>
            </div>
          </div>

          <div v-if="pestCalendar.prevention_calendar?.length > 0" class="pest-section">
            <h4 class="pest-subtitle">📅 防治日历</h4>
            <div class="pest-calendar-list">
              <div v-for="(item, i) in pestCalendar.prevention_calendar" :key="'pc-'+i" class="pest-calendar-item">
                <div class="pest-cal-icon">{{ item.icon || '🛡️' }}</div>
                <div class="pest-cal-content">
                  <div class="pest-cal-action">{{ item.action }}</div>
                  <div class="pest-cal-meta">
                    <span v-if="item.date">{{ item.date }}</span>
                    <span v-if="item.days_until != null" class="pest-cal-countdown">还有{{ item.days_until }}天</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 风险预警 -->
        <div v-if="riskAlerts.length > 0" class="card risk-alerts-card">
          <h3 class="card-title">
            <span class="title-emoji">⚠️</span> 风险预警
          </h3>
          <div class="risk-alerts-grid">
            <div v-for="(alert, i) in riskAlerts" :key="i" class="risk-alert-item" :class="'prob-' + (alert.probability || '低')">
              <div class="risk-alert-header">
                <span class="risk-alert-name">{{ alert.risk }}</span>
                <span class="risk-alert-badge">{{ alert.probability }}概率</span>
              </div>
              <div class="risk-alert-trigger">触发条件：{{ alert.trigger }}</div>
              <div class="risk-alert-impact">影响：{{ alert.impact }}</div>
              <div v-if="alert.prevention?.length > 0" class="risk-alert-prevention">
                <span class="risk-alert-prev-label">预防措施：</span>
                <ul class="risk-alert-prev-list">
                  <li v-for="(p, j) in alert.prevention" :key="j">{{ p }}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const store = useAppStore();
const config = computed(() => store.config);
const aiEnabled = computed(() => !!config.value.ai?.enabled);

const cropPlans = reactive({});
const selectedCropId = ref(null);
const COOLDOWN_SECONDS = 120;
const COOLDOWN_PREFIX = 'plan_cooldown_';
const GENERATING_TIMEOUT_MS = 300000;
function planStorageKey(cropId) { return cropId ? `plan_data_cache_${cropId}` : 'plan_data_cache'; }
function cooldownKey(cropId) { return cropId ? `${COOLDOWN_PREFIX}${cropId}` : COOLDOWN_PREFIX; }
let planLoaded = false;
const pollTimers = {};
const cooldownTimers = {};

function getCropState(cropId) {
  if (!cropId) return { plan: null, generating: false, timestamp: null, cooldown: 0 };
  if (!cropPlans[cropId]) {
    cropPlans[cropId] = { plan: null, generating: false, timestamp: null, cooldown: 0 };
  }
  return cropPlans[cropId];
}

function getSelectedCropState() {
  return getCropState(selectedCropId.value);
}

const plantingPlan = computed(() => cropPlans[selectedCropId.value]?.plan ?? null);
const planGenerating = computed(() => cropPlans[selectedCropId.value]?.generating ?? false);
const planTimestamp = computed(() => cropPlans[selectedCropId.value]?.timestamp ?? null);
const cooldownRemaining = computed(() => cropPlans[selectedCropId.value]?.cooldown ?? 0);

const activeCrops = computed(() => (config.value.crops || []).filter(c => c.status === 'active'));

const selectedCrop = computed(() => {
  if (!selectedCropId.value && activeCrops.value.length > 0) return activeCrops.value[0];
  return activeCrops.value.find(c => c.id === selectedCropId.value) || null;
});

const daysAfterTransplant = computed(() => {
  if (!selectedCrop.value?.planting_date) return 0;
  const plantDate = new Date(selectedCrop.value.planting_date);
  const now = new Date();
  const diff = Math.floor((now - plantDate) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
});

const parsedPlan = computed(() => {
  if (!plantingPlan.value) return {};
  if (typeof plantingPlan.value === 'string') {
    try { return JSON.parse(plantingPlan.value); } catch { return {}; }
  }
  return plantingPlan.value;
});

const hasPlanData = computed(() => {
  const p = parsedPlan.value;
  if (!p || typeof p !== 'object') return false;
  if (p.overview || p.milestones?.length > 0 || p.plan_overview || p.stage_plans?.length > 0) return true;
  if (p.operation_advice || p.risk_warning || p.safety_alert) return true;
  return false;
});

const planOverview = computed(() => parsedPlan.value?.overview || null);
const upcomingEvents = computed(() => {
  const events = parsedPlan.value?.upcoming_events;
  return Array.isArray(events) ? events : [];
});
const milestones = computed(() => {
  const ms = parsedPlan.value?.milestones;
  return Array.isArray(ms) ? ms : [];
});
const envAdvice = computed(() => parsedPlan.value?.environment_advice || null);
const stageGuide = computed(() => parsedPlan.value?.current_stage_guide || null);
const nextPreview = computed(() => parsedPlan.value?.next_stage_preview || null);
const pestCalendar = computed(() => parsedPlan.value?.pest_disease_calendar || null);
const riskAlerts = computed(() => {
  const alerts = parsedPlan.value?.risk_alerts;
  return Array.isArray(alerts) ? alerts : [];
});

function getCropIcon(type) {
  const m = { '番茄':'🍅','黄瓜':'🥒','辣椒':'🌶️','茄子':'🍆','草莓':'🍓','西瓜':'🍉','甜瓜':'🍈','生菜':'🥬','豆角':'🫛','菠菜':'🥬','芹菜':'🥬','韭菜':'🌿' };
  return m[type] || '🌱';
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return dateStr; }
}

function formatCooldown(s) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function getControlClass(status) {
  if (!status) return 'normal';
  if (status.includes('偏高') || status.includes('需要加强') || status.includes('需要浇水')) return 'warning';
  if (status.includes('偏低') || status.includes('需要减少') || status.includes('需要控水')) return 'alert';
  return 'normal';
}

function selectCrop(id) {
  if (id === selectedCropId.value) return;
  selectedCropId.value = id;
  loadCropPlan();
}

function startCooldown(cropId) {
  cropId = cropId || selectedCrop.value?.id;
  if (!cropId) return;
  const key = cooldownKey(cropId);
  const end = Date.now() + COOLDOWN_SECONDS * 1000;
  localStorage.setItem(key, String(end));
  const state = getCropState(cropId);
  state.cooldown = COOLDOWN_SECONDS;
  if (cooldownTimers[cropId]) clearInterval(cooldownTimers[cropId]);
  cooldownTimers[cropId] = setInterval(() => {
    const left = Math.ceil((Number(localStorage.getItem(key)) - Date.now()) / 1000);
    if (left <= 0) {
      state.cooldown = 0;
      localStorage.removeItem(key);
      clearInterval(cooldownTimers[cropId]);
      delete cooldownTimers[cropId];
    } else {
      state.cooldown = left;
    }
  }, 1000);
}

function restoreCooldown(cropId) {
  cropId = cropId || selectedCrop.value?.id;
  if (!cropId) return;
  const key = cooldownKey(cropId);
  const stored = localStorage.getItem(key);
  const state = getCropState(cropId);
  if (!stored) {
    state.cooldown = 0;
    return;
  }
  const left = Math.ceil((Number(stored) - Date.now()) / 1000);
  if (left > 0) {
    state.cooldown = left;
    if (cooldownTimers[cropId]) clearInterval(cooldownTimers[cropId]);
    cooldownTimers[cropId] = setInterval(() => {
      const l = Math.ceil((Number(localStorage.getItem(key)) - Date.now()) / 1000);
      if (l <= 0) {
        state.cooldown = 0;
        localStorage.removeItem(key);
        clearInterval(cooldownTimers[cropId]);
        delete cooldownTimers[cropId];
      } else {
        state.cooldown = l;
      }
    }, 1000);
  } else {
    localStorage.removeItem(key);
    state.cooldown = 0;
  }
}

function clearPollTimer(cropId) {
  if (pollTimers[cropId]) { clearInterval(pollTimers[cropId]); delete pollTimers[cropId]; }
}

async function pollForPlanResult(cropId) {
  cropId = cropId || selectedCrop.value?.id;
  if (!cropId) return;
  clearPollTimer(cropId);
  const state = getCropState(cropId);
  pollTimers[cropId] = setInterval(async () => {
    try {
      const res = await axios.get('/api/ai/results');
      const cropPlan = res.data?.planting_plans?.[cropId];
      const plan = cropPlan || res.data?.last_plan;
      if (plan?.data) {
        state.plan = plan.data;
        state.timestamp = new Date(plan.timestamp).toLocaleString('zh-CN');
        try {
          localStorage.setItem(planStorageKey(cropId), JSON.stringify({
            data: plan.data,
            timestamp: plan.timestamp,
            crop_id: cropId
          }));
        } catch {}
        clearPollTimer(cropId);
        state.generating = false;
        startCooldown(cropId);
        window.__modal?.showToast('✅ 种植计划生成成功', 'success');
      }
    } catch {}
  }, 5000);
  setTimeout(() => {
    if (pollTimers[cropId]) {
      clearPollTimer(cropId);
      state.generating = false;
      window.__modal?.showToast('生成超时，请重新尝试', 'warning');
    }
  }, GENERATING_TIMEOUT_MS);
}

async function recoverInterruptedGeneration(cropId) {
  try {
    const raw = localStorage.getItem('plan_generating_' + cropId);
    if (!raw) return;
    const info = JSON.parse(raw);
    const elapsed = Date.now() - (info.timestamp || 0);
    if (elapsed > GENERATING_TIMEOUT_MS) {
      localStorage.removeItem('plan_generating_' + cropId);
      return;
    }
    const state = getCropState(cropId);
    state.generating = true;
    pollForPlanResult(cropId);
  } catch {
    localStorage.removeItem('plan_generating_' + cropId);
  }
}

async function loadCropPlan() {
  const crop = selectedCrop.value;
  if (!crop) return;
  const cropId = crop.id;
  const state = getCropState(cropId);
  const storageKey = planStorageKey(cropId);
  let foundCache = false;
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (cached?.data && (!cached.crop_id || cached.crop_id === cropId)) {
      state.plan = cached.data;
      state.timestamp = cached.timestamp ? new Date(cached.timestamp).toLocaleString('zh-CN') : null;
      foundCache = true;
    }
  } catch {}
  if (!foundCache && crop.planting_plan) {
    state.plan = crop.planting_plan;
    foundCache = true;
  }
  if (!foundCache) {
    state.plan = null;
    state.timestamp = null;
  }
  try {
    const res = await axios.get('/api/ai/results');
    const cropPlan = res.data?.planting_plans?.[cropId];
    const plan = cropPlan || null;
    if (plan?.data) {
      state.plan = plan.data;
      state.timestamp = new Date(plan.timestamp).toLocaleString('zh-CN');
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          data: plan.data,
          timestamp: plan.timestamp,
          crop_id: cropId
        }));
      } catch {}
    }
  } catch (e) { /* ignore */ }
  restoreCooldown(cropId);
}

async function generatePlan() {
  const cropId = selectedCrop.value?.id;
  if (!cropId) {
    window.__modal?.showToast('请先添加作物', 'error');
    return;
  }
  const state = getCropState(cropId);
  if (state.cooldown > 0) {
    window.__modal?.showToast(`请等待冷却结束（剩余 ${formatCooldown(state.cooldown)}）`, 'warning');
    return;
  }

  state.generating = true;
  localStorage.setItem('plan_generating_' + cropId, JSON.stringify({ crop_id: cropId, timestamp: Date.now() }));
  try {
    const res = await axios.post('/api/ai/plan', {
      crop_id: cropId,
      crop_type: selectedCrop.value.type,
      variety_name: selectedCrop.value.variety_name,
      city: config.value.city,
      planting_date: selectedCrop.value.planting_date,
      current_stage: selectedCrop.value.current_stage,
      days_after_transplant: daysAfterTransplant.value,
      greenhouse_info: store.greenhouses[0],
      cultivation: { method: config.value.cultivation_method },
      history: config.value.history
    });
    state.plan = res.data.result;
    state.timestamp = new Date().toLocaleString('zh-CN');
    try {
      localStorage.setItem(planStorageKey(cropId), JSON.stringify({
        data: res.data.result,
        timestamp: new Date().toISOString(),
        crop_id: cropId
      }));
    } catch {}
    try { await axios.post('/api/ai/results/plan', { result: res.data.result, crop_id: cropId }); } catch {}
    startCooldown(cropId);
    localStorage.removeItem('plan_generating_' + cropId);
    window.__modal?.showToast('✅ 种植计划生成成功', 'success');
  } catch (err) {
    localStorage.removeItem('plan_generating_' + cropId);
    window.__modal?.showToast(err.response?.data?.error || '种植计划生成失败', 'error');
  } finally {
    state.generating = false;
  }
}

onMounted(async () => {
  await store.fetchConfig();
  for (const crop of activeCrops.value) {
    getCropState(crop.id);
  }
  if (activeCrops.value.length > 0) {
    selectedCropId.value = activeCrops.value[0].id;
    await loadCropPlan();
  }
  planLoaded = true;
  for (const crop of activeCrops.value) {
    restoreCooldown(crop.id);
    await recoverInterruptedGeneration(crop.id);
  }
});

onUnmounted(() => {
  Object.values(cooldownTimers).forEach(t => clearInterval(t));
  Object.values(pollTimers).forEach(t => clearInterval(t));
});

watch(activeCrops, async (crops) => {
  if (crops.length > 0 && !selectedCropId.value && planLoaded) {
    selectedCropId.value = crops[0].id;
    await loadCropPlan();
  }
}, { immediate: true });
</script>

<style scoped>
.plan-page {
  padding-bottom: 60px;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8fdf9 0%, #f0f9f4 100%);
}

.plan-header {
  background: linear-gradient(135deg, #2d7d46 0%, #43a047 100%);
  color: white;
  padding: 10px 16px;
  margin-bottom: 6px;
  box-shadow: 0 2px 8px rgba(45, 125, 70, 0.2);
}

.header-content { max-width: 600px; margin: 0 auto; }

.page-title {
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 1px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-icon { font-size: 18px; }

.page-subtitle {
  font-size: 11px;
  opacity: 0.9;
  margin: 0;
  font-weight: 400;
}

.card {
  background: white;
  border-radius: 10px;
  padding: 8px 10px;
  margin: 0 10px 5px 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 6px 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.title-emoji { font-size: 14px; }

.ai-disabled-card {
  background: linear-gradient(135deg, #fff9e6, #fff3cd);
  border: 2px solid #ffc107;
  text-align: center;
  padding: 16px;
}

.ai-disabled-icon { font-size: 36px; margin-bottom: 8px; }

.ai-disabled-text h3 { color: #856404; margin: 0 0 6px 0; font-size: 15px; }
.ai-disabled-text p { color: #856404; margin: 0 0 12px 0; font-size: 13px; }

.crop-select-info-card {
  padding: 6px 10px;
}

.crop-chips-row {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  margin-bottom: 5px;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
  -webkit-overflow-scrolling: touch;
}

.crop-chips-row::-webkit-scrollbar {
  height: 4px;
}

.crop-chips-row::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 2px;
}

.crop-chips-row::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.crop-chips-row.scrollable::-webkit-scrollbar-thumb {
  background: #aaa;
}

.crop-chips-row + .crop-info-row {
  padding-top: 5px;
  border-top: 1px solid #f0f0f0;
}

.crop-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: 18px;
  border: 1.5px solid #e0e0e0;
  background: white;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

.crop-chip.active {
  border-color: #2d7d46;
  background: #f0f9f4;
  color: #2d7d46;
  font-weight: 600;
}

.crop-info-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.crop-info-icon { font-size: 17px; }

.crop-info-name {
  font-size: 13px;
  font-weight: 700;
}

.crop-info-greenhouse {
  font-size: 11px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 6px;
}

.crop-meta-inline {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.meta-tag {
  font-size: 10px;
  background: #f0f9f4;
  color: #2d7d46;
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 500;
}

.btn-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}

.btn-inline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-gen {
  background: linear-gradient(135deg, #2d7d46, #43a047);
  color: white;
}

.btn-gen:hover:not(:disabled) {
  background: linear-gradient(135deg, #256b3a, #389540);
}

.btn-regen {
  background: white;
  color: #2d7d46;
  border: 1.5px solid #2d7d46;
}

.btn-regen:hover:not(:disabled) {
  background: #f0f9f4;
}

.btn-loading {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.btn-regen .btn-loading {
  border-color: rgba(45, 125, 70, 0.3);
  border-top-color: #2d7d46;
}

@keyframes spin { to { transform: rotate(360deg); } }

.update-badge-row {
  font-size: 10px;
  color: #999;
  text-align: right;
  padding: 1px 3px 0;
  flex-basis: 100%;
  order: 1;
}

.empty-state-card {
  background: white;
  border-radius: 10px;
  padding: 20px 16px;
  margin: 10px;
  text-align: center;
  border: 2px dashed #e0e0e0;
}

.empty-icon-large {
  font-size: 40px;
  opacity: 0.6;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.empty-title { font-size: 15px; font-weight: 700; margin: 8px 0 4px 0; }
.empty-description { font-size: 12px; color: #666; line-height: 1.4; margin: 0; }

.loading-state-card {
  background: white;
  border-radius: 10px;
  padding: 20px 16px;
  margin: 10px;
  text-align: center;
  border: 2px solid rgba(45, 125, 70, 0.2);
}

.loading-animation {
  position: relative;
  width: 48px;
  height: 48px;
  margin: 0 auto 10px;
}

.loading-spinner {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid #e8f5e9;
  border-top-color: #2d7d46;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-dots {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 5px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: #2d7d46;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.loading-title { font-size: 15px; font-weight: 700; margin: 0 0 4px 0; }
.loading-description { font-size: 12px; color: #666; margin: 0; }

.plan-result-section { padding: 0 0 10px 0; }

/* === 总览卡片 === */
.overview-card {
  background: linear-gradient(135deg, #ffffff, #f0f9f4) !important;
  border: 1px solid rgba(45, 125, 70, 0.15);
}

.overview-header { margin-bottom: 4px; }

.overview-title-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 3px;
}

.overview-icon { font-size: 18px; }
.overview-crop-name { font-size: 14px; font-weight: 700; margin: 0; color: #2d7d46; }

.overview-greenhouse {
  font-size: 11px;
  color: #888;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 6px;
  margin-left: 2px;
}

.overview-progress-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: #e8f5e9;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #43a047, #66bb6a);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.progress-text {
  font-size: 11px;
  font-weight: 700;
  color: #2d7d46;
  min-width: 30px;
  text-align: right;
}

.overview-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.stat-item {
  text-align: center;
  padding: 3px 2px;
  background: white;
  border-radius: 5px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #2d7d46;
  line-height: 1.2;
}

.stat-value.harvest { font-size: 11px; }

.stat-label {
  font-size: 9px;
  color: #888;
  margin-top: 0;
}

.overview-stage-info {
  display: flex;
  align-items: center;
  gap: 5px;
}

.stage-badge {
  background: linear-gradient(135deg, #2d7d46, #43a047);
  color: white;
  padding: 1px 8px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
}

.stage-day {
  font-size: 10px;
  color: #666;
}

/* === 倒计时提醒 === */
.countdown-card {
  border-left: 3px solid #ff9800;
}

.countdown-title { color: #e65100; }

.countdown-list { display: flex; flex-direction: column; gap: 5px; }

.countdown-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.countdown-item.urgency-即将 {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-left: 3px solid #ff9800;
}

.countdown-item.urgency-临近 {
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  border-left: 3px solid #ffc107;
}

.countdown-item.urgency-规划 {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border-left: 3px solid #4caf50;
}

.countdown-item.urgency-远期 {
  background: #f5f5f5;
  border-left: 3px solid #9e9e9e;
}

.countdown-days-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  padding: 4px 3px;
  background: linear-gradient(135deg, #ff9800, #f57c00);
  border-radius: 6px;
  color: white;
  flex-shrink: 0;
}

.days-number { font-size: 17px; font-weight: 800; line-height: 1; }
.days-unit { font-size: 9px; opacity: 0.9; }

.countdown-content { flex: 1; min-width: 0; }

.countdown-event {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 3px;
}

.event-icon { font-size: 14px; }

.countdown-action {
  font-size: 11px;
  color: #666;
  margin-top: 1px;
  line-height: 1.3;
}

/* === 横向时间轴 === */
.timeline-card { overflow: hidden; }

.h-timeline-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 5px;
  margin: 0 -10px;
  padding: 0 10px 5px 10px;
}

.h-timeline-scroll {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: max-content;
  position: relative;
  padding-top: 6px;
  padding-bottom: 2px;
}

.h-timeline-line {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  height: 2px;
  background: #e0e0e0;
  z-index: 0;
}

.h-timeline-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 90px;
  position: relative;
  z-index: 1;
  text-align: center;
}

.h-node-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
  background: white;
  border: 2px solid #e0e0e0;
}

.h-timeline-node.status-已完成 .h-node-dot {
  background: #4caf50;
  border-color: #4caf50;
}

.h-timeline-node.status-进行中 .h-node-dot {
  background: white;
  border-color: #ff9800;
  box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.2);
}

.dot-check { color: white; font-size: 10px; font-weight: 700; }
.dot-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9800;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

.dot-empty {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
}

.h-node-label {
  font-size: 11px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.h-timeline-node.status-已完成 .h-node-label { color: #4caf50; }
.h-timeline-node.status-进行中 .h-node-label { color: #ff9800; font-weight: 700; }

.h-node-date {
  font-size: 9px;
  color: #999;
  margin-top: 1px;
}

.h-node-duration {
  font-size: 9px;
  color: #888;
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 5px;
  margin-top: 1px;
}

.h-node-current {
  font-size: 10px;
  font-weight: 700;
  color: #ff9800;
  background: #fff3e0;
  padding: 1px 6px;
  border-radius: 6px;
  margin-top: 2px;
  border: 1px solid #ffe0b2;
}

.h-node-event {
  font-size: 9px;
  color: #666;
  margin-top: 2px;
  line-height: 1.2;
  max-width: 85px;
}

/* === 环境建议 === */
.env-weather-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border-radius: 6px;
  margin-bottom: 5px;
}

.weather-main { display: flex; align-items: baseline; gap: 6px; }
.weather-temp { font-size: 18px; font-weight: 700; color: #1565c0; }
.weather-desc { font-size: 11px; color: #42a5f5; }
.weather-humidity { font-size: 11px; color: #1976d2; }

.env-forecast {
  font-size: 11px;
  color: #666;
  padding: 5px 8px;
  background: #f5f5f5;
  border-radius: 5px;
  margin-bottom: 6px;
  line-height: 1.3;
}

.env-controls { display: flex; flex-direction: column; gap: 5px; }

.env-control-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f9f9f9;
}

.env-control-item.status-warning {
  background: linear-gradient(135deg, #fff8e1, #fff3e0);
  border-left: 3px solid #ff9800;
}

.env-control-item.status-alert {
  background: linear-gradient(135deg, #fce4ec, #ffebee);
  border-left: 3px solid #f44336;
}

.env-control-item.status-normal {
  background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
  border-left: 3px solid #4caf50;
}

.control-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.control-info { flex: 1; min-width: 0; }
.control-title { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 1px; }
.control-detail { font-size: 11px; color: #666; line-height: 1.3; }
.control-action { font-size: 11px; color: #2d7d46; font-weight: 500; margin-top: 1px; }

.control-status-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  background: white;
  color: #666;
  flex-shrink: 0;
  white-space: nowrap;
}

.env-control-item.status-warning .control-status-tag { color: #e65100; background: #fff3e0; }
.env-control-item.status-alert .control-status-tag { color: #c62828; background: #ffebee; }
.env-control-item.status-normal .control-status-tag { color: #2e7d32; background: #e8f5e9; }

/* === 今日任务 === */
.today-tasks-card { border-left: 3px solid #2d7d46; }

.task-stage-info {
  font-size: 10px;
  font-weight: 400;
  color: #888;
  margin-left: auto;
}

.tasks-list { display: flex; flex-direction: column; gap: 5px; }

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #f9f9f9;
}

.task-item.importance-必须 {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border-left: 3px solid #ff9800;
}

.task-item.importance-重要 {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border-left: 3px solid #4caf50;
}

.task-item.importance-建议 {
  background: #f5f5f5;
  border-left: 3px solid #9e9e9e;
}

.task-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.task-content { flex: 1; min-width: 0; }
.task-name { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 1px; }
.task-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 1px; }
.task-time { font-size: 10px; color: #888; }
.task-importance-tag {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(0,0,0,0.05);
  color: #666;
}

.task-item.importance-必须 .task-importance-tag { background: #fff3e0; color: #e65100; }
.task-item.importance-重要 .task-importance-tag { background: #e8f5e9; color: #2e7d32; }

.task-method { font-size: 11px; color: #555; line-height: 1.3; }

.week-tasks, .watch-points {
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid #f0f0f0;
}

.week-title, .watch-title {
  font-size: 11px;
  font-weight: 600;
  margin: 0 0 3px 0;
  color: #333;
}

.week-list, .watch-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: #555;
  line-height: 1.6;
}

.watch-list { color: #e65100; }

/* === 下一阶段预告 === */
.next-stage-card { border-left: 3px solid #7b1fa2; }

.next-stage-countdown {
  font-size: 10px;
  font-weight: 600;
  color: #7b1fa2;
  background: #f3e5f5;
  padding: 2px 8px;
  border-radius: 8px;
  margin-left: auto;
}

.next-stage-header { margin-bottom: 5px; }
.next-stage-name { font-size: 14px; font-weight: 700; color: #7b1fa2; margin: 0 0 2px 0; }
.next-stage-date { font-size: 11px; color: #888; }

.sub-title {
  font-size: 11px;
  font-weight: 600;
  margin: 6px 0 3px 0;
  color: #333;
}

.sub-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: #555;
  line-height: 1.6;
}

.pollination-guide {
  margin-top: 6px;
  padding: 6px 8px;
  background: linear-gradient(135deg, #fce4ec, #f3e5f5);
  border-radius: 6px;
  border: 1px solid #e1bee7;
}

.pollination-info { margin-bottom: 3px; }
.poll-row { font-size: 11px; color: #555; margin-bottom: 1px; }
.poll-label { font-weight: 600; color: #7b1fa2; }

.poll-tips { display: flex; flex-direction: column; gap: 3px; }
.poll-tip-item {
  font-size: 11px;
  color: #555;
  padding: 3px 6px;
  background: rgba(255,255,255,0.6);
  border-radius: 4px;
}

/* === 病虫害防治 === */
.pest-card { border-left: 3px solid #d32f2f; }

.pest-section { margin-bottom: 6px; }
.pest-section:last-child { margin-bottom: 0; }

.pest-subtitle {
  font-size: 11px;
  font-weight: 600;
  margin: 0 0 5px 0;
  color: #333;
}

.pest-risk-item {
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 5px;
}

.pest-risk-item.risk-高 {
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
  border-left: 3px solid #f44336;
}

.pest-risk-item.risk-中 {
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  border-left: 3px solid #ff9800;
}

.pest-risk-item.risk-低 {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border-left: 3px solid #4caf50;
}

.pest-risk-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}

.pest-risk-name { font-size: 12px; font-weight: 700; color: #333; }

.pest-risk-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background: white;
}

.pest-risk-item.risk-高 .pest-risk-badge { color: #c62828; }
.pest-risk-item.risk-中 .pest-risk-badge { color: #e65100; }
.pest-risk-item.risk-低 .pest-risk-badge { color: #2e7d32; }

.pest-countdown {
  font-size: 10px;
  color: #888;
}

.pest-symptoms { font-size: 11px; color: #555; margin-bottom: 1px; }
.pest-prevention { font-size: 11px; color: #555; margin-bottom: 1px; }
.pest-prevention-label, .pest-treatment-label { font-weight: 600; }
.pest-treatment { font-size: 11px; color: #555; }

.pest-upcoming-item {
  padding: 6px 8px;
  border-radius: 6px;
  background: #f5f5f5;
  margin-bottom: 5px;
}

.pest-upcoming-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.pest-upcoming-name { font-size: 11px; font-weight: 600; color: #333; }
.pest-upcoming-countdown {
  font-size: 10px;
  font-weight: 600;
  color: #ff9800;
  background: #fff3e0;
  padding: 1px 6px;
  border-radius: 5px;
}

.pest-upcoming-trigger { font-size: 11px; color: #666; margin-bottom: 1px; }
.pest-upcoming-prevention { font-size: 11px; color: #555; }

.pest-calendar-list { display: flex; flex-direction: column; gap: 4px; }

.pest-calendar-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 8px;
  background: #f9f9f9;
  border-radius: 5px;
  border-left: 3px solid #4caf50;
}

.pest-cal-icon { font-size: 14px; flex-shrink: 0; }
.pest-cal-content { flex: 1; }
.pest-cal-action { font-size: 11px; color: #333; font-weight: 500; }
.pest-cal-meta { font-size: 10px; color: #888; margin-top: 1px; display: flex; gap: 6px; }
.pest-cal-countdown { color: #ff9800; font-weight: 600; }

/* === 风险预警 === */
.risk-alerts-card { border-left: 3px solid #f44336; }

.risk-alerts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}

.risk-alert-item {
  padding: 6px 8px;
  border-radius: 6px;
  min-width: 0;
}

.risk-alert-item.prob-高 {
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
  border-left: 3px solid #f44336;
}

.risk-alert-item.prob-中 {
  background: linear-gradient(135deg, #fff8e1, #ffecb3);
  border-left: 3px solid #ff9800;
}

.risk-alert-item.prob-低 {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border-left: 3px solid #4caf50;
}

.risk-alert-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.risk-alert-name { font-size: 12px; font-weight: 700; color: #333; }

.risk-alert-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 6px;
  background: white;
}

.risk-alert-item.prob-高 .risk-alert-badge { color: #c62828; }
.risk-alert-item.prob-中 .risk-alert-badge { color: #e65100; }
.risk-alert-item.prob-低 .risk-alert-badge { color: #2e7d32; }

.risk-alert-trigger, .risk-alert-impact { font-size: 11px; color: #555; margin-bottom: 1px; }
.risk-alert-prevention { margin-top: 2px; }
.risk-alert-prev-label { font-size: 11px; font-weight: 600; color: #333; }
.risk-alert-prev-list {
  margin: 1px 0 0 14px;
  padding: 0;
  font-size: 11px;
  color: #555;
  line-height: 1.5;
}

/* 滚动条美化 */
.h-timeline-wrapper::-webkit-scrollbar {
  height: 4px;
}

.h-timeline-wrapper::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 2px;
}

.h-timeline-wrapper::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}
</style>
