<template>
  <div class="page home-page">
    <!-- Weather Panel -->
    <div class="weather-card" :class="{ skeleton: weatherLoading }">
      <template v-if="!weatherLoading && weather?.merged">
        <!-- Top row: Temperature + City + Update time -->
        <div class="weather-top-row">
          <div class="weather-temp-compact">
            <span class="temp-value">{{ Math.round(weather.merged.temperature) }}°</span>
            <span class="weather-desc">{{ weather.merged.weather_desc || '未知' }}</span>
          </div>
          <div class="weather-right-info">
            <span class="weather-city">{{ weather.merged.city }}</span>
            <span class="update-time-inline">{{ formatTime(weather.lastUpdate) }}</span>
          </div>
        </div>

        <!-- Middle row: Details + Forecast inline -->
        <div class="weather-middle-row">
          <div class="weather-details-inline">
            <span>湿度 {{ weather.merged.humidity }}%</span>
            <span>风速 {{ weather.merged.wind_speed?.toFixed(1) }}m/s</span>
            <span>降水 {{ weather.merged.precipitation || 0 }}mm</span>
          </div>
        </div>

        <!-- Forecast row: Show 7 days -->
        <div class="forecast-row" v-if="weather.merged.forecast?.length > 1">
          <div v-for="(day, i) in weather.merged.forecast.slice(1, 8)" :key="i" class="forecast-day">
            <div class="forecast-date">{{ formatForecastDate(day.date) }}</div>
            <div class="forecast-icon">{{ getWeatherIcon(day.weather_code) }}</div>
            <div class="forecast-temp">{{ day.temp_min }}~{{ day.temp_max }}°</div>
          </div>
        </div>

        <!-- Bottom row: Sources + Spray window -->
        <div class="weather-bottom-row">
          <div class="source-badges">
            <span class="badge" :class="weather.sources?.status?.openMeteo ? 'badge-online' : 'badge-offline'">Open-Meteo</span>
            <span class="badge" :class="weather.sources?.status?.wttr ? 'badge-online' : 'badge-offline'">wttr.in</span>
          </div>
          <div v-if="weather.sprayWindow" class="spray-window-inline">
            <span class="spray-icon">💧</span>
            <span v-if="weather.sprayWindow.available">打药窗口可用</span>
            <span v-else>{{ weather.sprayWindow.reason }}</span>
          </div>
        </div>
      </template>
      <div v-else-if="!weatherLoading" class="weather-unavailable">
        天气数据暂不可用
      </div>
    </div>

    <!-- Growth Status Cards -->
    <div v-if="activeCrops.length > 0" class="growth-section">
      <h3 class="section-title">生长状态</h3>
      <div v-if="hasRenderError" class="growth-error-fallback">
        <span class="error-icon">⚠️</span>
        <span>数据加载异常，请刷新页面重试</span>
        <button class="btn btn-outline btn-sm" @click="hasRenderError = false">重试</button>
      </div>
      <div v-else @error="handleRenderError" class="growth-grid">
        <div v-for="crop in activeCrops" :key="crop.id" class="card growth-card enhanced">
        <div class="growth-header">
          <div class="crop-info-main">
            <span class="crop-icon">{{ getCropIcon(crop.type) }}</span>
            <div>
              <span class="growth-name">{{ crop.type }} · {{ crop.variety_name }}</span>
              <div class="growth-meta-row">
                <span class="growth-location">{{ crop.greenhouse_name }}</span>
                <span class="meta-separator">|</span>
                <span class="planting-date" v-if="crop.planting_date">{{ formatDate(crop.planting_date) }}种植</span>
                <span class="meta-separator" v-if="crop.planting_date && getHarvestDate(crop)">|</span>
                <span class="harvest-date" v-if="getHarvestDate(crop)">预计{{ getHarvestDate(crop) }}采收</span>
              </div>
            </div>
          </div>
          <div class="health-badge" :class="getHealthClass(crop)" :title="getHealthTooltip(crop)">
            {{ getHealthStatus(crop).icon }} {{ getHealthStatus(crop).text }}
          </div>
        </div>

        <div class="stage-progress-section">
          <div class="stage-label-row">
            <span class="stage-name">{{ crop.current_stage }}</span>
            <span class="days-count">{{ formatDaysAfterTransplant(crop.days_after_transplant) }}</span>
          </div>

          <div class="progress-container-enhanced">
            <div class="progress-bar-enhanced">
              <div
                class="progress-fill-animated"
                :style="{
                  width: getEnhancedProgress(crop) + '%',
                  background: getStageGradient(crop)
                }"
              ></div>
              <div
                v-for="(stage, idx) in getAllStages(crop)"
                :key="stage"
                class="stage-marker-dot"
                :class="{
                  active: stage === crop.current_stage,
                  passed: isStagePassed(crop, stage, idx),
                  future: !isStagePassed(crop, stage, idx) && stage !== crop.current_stage
                }"
                :style="{ left: ((idx + 1) / (getAllStages(crop).length + 1)) * 100 + '%' }"
                :title="stage"
              ></div>
            </div>
          </div>

          <div class="progress-stats">
            <span>{{ getEnhancedProgress(crop) }}% 完成</span>
            <span class="stats-separator">|</span>
            <span>剩余约 {{ getDaysRemaining(crop) }} 天</span>
          </div>
        </div>

        <div class="growth-metrics-compact" v-if="crop.latestRecord || getCropAiPrediction(crop)">
          <div class="metric-item" v-if="crop.latestRecord?.['株高(cm)']">
            <span class="metric-icon">📏</span>
            <span class="metric-value">{{ crop.latestRecord['株高(cm)'] }}cm</span>
          </div>
          <div class="metric-item" v-if="crop.latestRecord?.['花朵数(个)']">
            <span class="metric-icon">🌸</span>
            <span class="metric-value">{{ crop.latestRecord['花朵数(个)'] }}朵</span>
          </div>
          <div class="metric-item" v-if="crop.latestRecord?.['坐果数(个)']">
            <span class="metric-icon">🍅</span>
            <span class="metric-value">{{ crop.latestRecord['坐果数(个)'] }}个</span>
          </div>
          <div class="metric-item ai-prediction" v-if="getCropAiPrediction(crop) && !isCropAiLoading(crop)">
            <span class="metric-icon">🤖</span>
            <div class="ai-prediction-content"
                 @click="toggleAiTooltip(crop)">
              <span class="metric-value prediction-text">{{ getCropAiPrediction(crop).status }}</span>
              <span class="ai-update-time"
                    v-if="getAiPredictionTimestamp(crop)"
                    :title="'更新时间: ' + formatFullTimestamp(getAiPredictionTimestamp(crop))">· {{ formatAiTimestamp(getAiPredictionTimestamp(crop)) }}</span>
              <span class="ai-expand-hint">详情</span>
            </div>
            <div class="ai-tooltip-mobile" v-if="isAiTooltipVisible(crop)" @click.stop>
              <button class="tooltip-close-inline" @click="toggleAiTooltip(crop)">✕ 关闭</button>

              <div class="ai-tooltip-body">
                <div class="ai-section status-row">
                  <span class="status-text">{{ getCropAiPrediction(crop).status }}</span>
                  <span class="risk-badge-inline" :class="'risk-' + (getCropAiPrediction(crop).risk_level || 'low')" v-if="getCropAiPrediction(crop).risk_level">{{ getRiskLabel(getCropAiPrediction(crop).risk_level) }}</span>
                </div>

                <div class="ai-section" v-if="getCropAiPrediction(crop).summary">
                  <div class="analysis-text">{{ getCropAiPrediction(crop).summary }}</div>
                </div>

                <ul class="suggestions-list-compact" v-if="getCropAiPrediction(crop).recommendations?.length">
                  <li v-for="(rec, ri) in getCropAiPrediction(crop).recommendations" :key="ri">{{ rec }}</li>
                </ul>

                <div class="milestone-text" v-if="getCropAiPrediction(crop).next_milestone">{{ getCropAiPrediction(crop).next_milestone }}</div>
              </div>
            </div>
          </div>
          <div class="metric-item ai-loading" v-if="isCropAiLoading(crop)">
            <span class="metric-icon">⏳</span>
            <span class="metric-value">AI分析中...</span>
          </div>
          <div class="metric-item stage-action-inline">
            <button class="btn btn-outline btn-sm" @click="advanceStage(crop)">下一阶段 →</button>
          </div>
        </div>

        <details class="stage-timeline-details" v-if="getStageTimeline(crop).length > 0">
          <summary class="timeline-summary">阶段详情 ▼</summary>
          <div class="timeline-content">
            <div
              v-for="(stageInfo, idx) in getStageTimeline(crop)"
              :key="stageInfo.name"
              class="timeline-stage-item"
              :class="{ current: stageInfo.name === crop.current_stage, completed: stageInfo.completed }"
            >
              <div class="timeline-marker"></div>
              <div class="timeline-info">
                <div class="timeline-stage-name">{{ stageInfo.name }}</div>
                <div class="timeline-stage-meta">
                  <span v-if="stageInfo.startDate">{{ formatDate(stageInfo.startDate) }}</span>
                  <span v-if="stageInfo.endDate"> - {{ formatDate(stageInfo.endDate) }}</span>
                  <span v-if="stageInfo.typicalDays">({{ stageInfo.typicalDays }}天)</span>
                </div>
                <div class="timeline-tasks" v-if="stageInfo.tasks?.length">
                  <span v-for="(task, ti) in stageInfo.tasks.slice(0, 3)" :key="ti" class="task-tag">{{ task }}</span>
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
      </div>
    </div>

    <!-- Today's operations from planting plan -->
    <div v-if="todayOps?.length > 0" class="card today-ops-card">
      <h3 class="card-title">今日操作（{{ today }}）</h3>
      <div v-for="(op, i) in todayOps" :key="i" class="today-op-item">
        <div class="today-op-icon" :style="{ background: op.color || '#4caf50' }">{{ op.icon }}</div>
        <div class="today-op-content">
          <div class="today-op-title">{{ op.title }}</div>
          <div class="today-op-desc">{{ op.description }}</div>
        </div>
      </div>
    </div>

    <!-- AI Analysis Results - Per Crop Carousel -->
    <div v-if="cropAnalyses.length > 0" class="analysis-results">
      <div class="card decision-card analysis-box crop-analysis-carousel" :class="getPriorityClass(currentCropAnalysis?.operation_advice?.priority)">
        <div class="analysis-header">
          <span class="decision-type-badge">智能分析</span>
          <span class="analysis-title-inline" v-if="currentCropAnalysis">{{ currentCropAnalysis.operation_advice?.title || '今日操作建议' }}</span>
          <span class="update-time" v-if="analysisTimestamp">{{ formatTime(analysisTimestamp) }}</span>
          <div class="carousel-dots" v-if="cropAnalyses.length > 1">
            <span
              v-for="(item, ci) in cropAnalyses"
              :key="ci"
              class="dot"
              :class="{ active: ci === cropAnalysisIndex }"
              @click="switchCropAnalysis(ci)"
            ></span>
          </div>
        </div>
        <div v-if="currentCropAnalysis" class="alert-crop-tags single-tag">
          <span class="alert-crop-tag">
            {{ getCropIcon(currentCropAnalysis.crop_type) }} {{ currentCropAnalysis.greenhouse_name }} · {{ currentCropAnalysis.crop_type }} {{ currentCropAnalysis.variety_name }}
          </span>
        </div>
        <div v-if="currentCropAnalysis?.operation_advice?.summary" class="decision-summary compact">{{ currentCropAnalysis.operation_advice.summary }}</div>
        <ul v-if="currentCropAnalysis?.operation_advice?.actions" class="decision-actions compact">
          <li v-for="(a, i) in currentCropAnalysis.operation_advice.actions" :key="i">{{ a }}</li>
        </ul>
        <div v-if="currentCropAnalysis?.risk_warning?.summary" class="crop-risk-row">
          <span class="crop-risk-badge" :class="getLevelClass(currentCropAnalysis.risk_warning.level)">⚠ {{ currentCropAnalysis.risk_warning.level }}</span>
          <span class="crop-risk-summary">{{ currentCropAnalysis.risk_warning.summary }}</span>
        </div>
        <div v-if="currentCropAnalysis?.operation_advice?.reason" class="decision-reason compact">{{ currentCropAnalysis.operation_advice.reason }}</div>
      </div>
    </div>

    <!-- Decision Cards (Rule Engine) -->
    <div v-if="decisionCards.length > 0" class="decision-section">
      <div class="decision-grid">
        <div v-for="(group, gi) in decisionGroups" :key="gi" class="card decision-carousel" :class="getPriorityClass(group.currentCard?.priority)">
          <div class="carousel-header">
            <div class="decision-type-badge">{{ group.currentCard?.type }}</div>
            <span class="update-time" v-if="decisionTimestamp">{{ formatTime(decisionTimestamp) }}</span>
            <div class="carousel-dots">
              <span
                v-for="(card, ci) in group.cards"
                :key="ci"
                class="dot"
                :class="{ active: ci === group.currentIndex }"
                @click="switchCard(gi, ci)"
              ></span>
            </div>
          </div>
          <div class="decision-title">{{ group.currentCard?.advice }}</div>
          <div v-if="group.currentCard?.greenhouse || group.currentCard?.crop" class="decision-crop-info">
            <span v-if="group.currentCard?.greenhouse" class="crop-info-greenhouse">🏠 {{ group.currentCard.greenhouse }}</span>
            <span v-if="group.currentCard?.crop" class="crop-info-crop">{{ getCropIcon(group.currentCard.crop) }} {{ group.currentCard.crop }} {{ group.currentCard.variety || '' }}</span>
          </div>
          <div v-if="group.currentCard?.warnings?.length > 0" class="decision-warnings">
            <div v-for="(w, i) in group.currentCard.warnings" :key="i" class="warning-item">⚠ {{ w }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Safety Interval Tracking -->
    <div v-if="safetyRecords.length > 0" class="card safety-interval-card">
      <h3 class="card-title">安全间隔追踪</h3>
      <div v-for="rec in safetyRecords" :key="rec.id" class="safety-item">
        <div class="safety-icon">⚠</div>
        <div class="safety-text">
          距安全采收还有 <strong>{{ rec.remainingDays }}</strong> 天
          （{{ rec.details?.pesticide_name }}，防治{{ rec.details?.target }}）
        </div>
      </div>
    </div>

    <!-- Recent Operations -->
    <div v-if="recentOps.length > 0" class="card recent-ops-card">
      <h3 class="card-title">最近操作</h3>
      <div class="recent-ops-scroll">
        <div v-for="op in recentOps" :key="op.id" class="recent-op-item">
          <span class="op-icon">{{ getOpIcon(op.type) }}</span>
          <span class="op-desc">{{ op.type }} - {{ op.crop_name }}</span>
          <span class="op-date">{{ op.date }}</span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!config.initialized" class="empty-state">
      <p>系统尚未初始化</p>
      <button class="btn btn-primary" @click="$router.push('/setup')">开始配置</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const store = useAppStore();
const config = computed(() => store.config);
const weather = computed(() => store.weather);
const weatherLoading = ref(true);
const decisionCards = ref([]);
const carouselIndices = ref([]);
let carouselTimer = null;
const analysisResult = ref(null);
const analysisTimestamp = ref(null);
const cropAnalysisIndex = ref(0);
let cropAnalysisTimer = null;
const aiAnalyzing = ref(false);
const analysisCooldown = ref(0);
const analysisDisabled = computed(() => aiAnalyzing.value || analysisCooldown.value > 0);
const safetyRecords = ref([]);
const recentOps = ref([]);
const todayOps = ref([]);
const latestRecords = ref({});
const cropKnowledgeCache = ref({});

const aiPredictionsMap = reactive({});
const aiPredictionLoadingMap = reactive({});

const AI_CACHE_KEY = 'agri_ai_growth_predictions';
let isInitializingAi = false;
const hasRenderError = ref(false);

let cooldownTimer = null;
let dailyAiTimer = null;

const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

const activeCrops = computed(() => {
  return (config.value.crops || []).filter(c => c.status === 'active');
});

const cropAnalyses = computed(() => {
  return analysisResult.value?.crop_analyses || [];
});

const currentCropAnalysis = computed(() => {
  return cropAnalyses.value[cropAnalysisIndex.value] || null;
});

function switchCropAnalysis(index) {
  cropAnalysisIndex.value = index;
  resetCropAnalysisTimer();
}

function startCropAnalysisCarousel() {
  if (cropAnalysisTimer) clearInterval(cropAnalysisTimer);
  if (cropAnalyses.value.length <= 1) return;
  cropAnalysisTimer = setInterval(() => {
    cropAnalysisIndex.value = (cropAnalysisIndex.value + 1) % cropAnalyses.value.length;
  }, 5000);
}

function resetCropAnalysisTimer() {
  if (cropAnalysisTimer) clearInterval(cropAnalysisTimer);
  startCropAnalysisCarousel();
}

async function loadData() {
  // Load persisted AI results from server
  try {
    const aiRes = await axios.get('/api/ai/results');
    if (aiRes.data?.last_analysis?.data) {
      analysisResult.value = aiRes.data.last_analysis.data;
      analysisTimestamp.value = new Date(aiRes.data.last_analysis.timestamp).toLocaleString('zh-CN');
      cropAnalysisIndex.value = 0;
      startCropAnalysisCarousel();
    }
  } catch (e) {}
  weatherLoading.value = true;
  try {
    await Promise.allSettled([
      store.fetchConfig(),
      store.fetchWeather(),
      fetchDecisionCards(),
      fetchRecentOps(),
      fetchAiUsage(),
      fetchSafetyRecords(),
    ]);
  } finally {
    weatherLoading.value = false;
  }
}

const decisionTimestamp = ref(null);

async function fetchDecisionCards() {
  try {
    const res = await axios.get('/api/decisions');
    decisionCards.value = res.data.decisions || res.data || [];
    decisionTimestamp.value = res.data.timestamp || new Date().toISOString();
    initCarousel();
  } catch (e) {
    decisionCards.value = [];
  }
}

function initCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
  const groups = groupCardsByType(decisionCards.value);
  carouselIndices.value = groups.map(() => 0);
  startCarousel();
}

function groupCardsByType(cards) {
  const groups = {};
  cards.forEach(card => {
    const type = card.type || '建议';
    if (!groups[type]) groups[type] = [];
    groups[type].push(card);
  });
  return Object.entries(groups).map(([type, cards]) => ({ type, cards }));
}

const decisionGroups = computed(() => {
  const groups = groupCardsByType(decisionCards.value);
  return groups.slice(0, 2).map((group, gi) => ({
    ...group,
    currentIndex: carouselIndices.value[gi] || 0,
    currentCard: group.cards[carouselIndices.value[gi] || 0]
  }));
});

function switchCard(groupIndex, cardIndex) {
  carouselIndices.value[groupIndex] = cardIndex;
}

function startCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(() => {
    const groups = decisionGroups.value;
    groups.forEach((group, gi) => {
      if (group.cards.length > 1) {
        carouselIndices.value[gi] = (carouselIndices.value[gi] + 1) % group.cards.length;
      }
    });
  }, 3000);
}

async function fetchRecentOps() {
  try {
    const res = await axios.get('/api/operations?limit=15');
    recentOps.value = res.data;
  } catch (e) {}
}

async function fetchAiUsage() {
  try {
    const res = await axios.get('/api/ai/usage');
    if (res.data.cooldown_remaining) {
      analysisCooldown.value = res.data.cooldown_remaining;
      startCooldownTimer();
    }
  } catch (e) {}
}

async function fetchSafetyRecords() {
  try {
    const res = await axios.get('/api/operations?type=打药');
    const pesticideOps = res.data;
    const now = new Date();
    safetyRecords.value = pesticideOps
      .filter(op => {
        if (!op.safety_interval_end) return false;
        const endDate = new Date(op.safety_interval_end);
        return endDate > now;
      })
      .map(op => {
        const endDate = new Date(op.safety_interval_end);
        const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        return { ...op, remainingDays };
      })
      .slice(0, 5);
  } catch (e) {}
}

async function runAnalysis() {
  aiAnalyzing.value = true;
  try {
    const res = await axios.post('/api/ai/analyze', {});
    analysisResult.value = res.data.result;
    analysisTimestamp.value = new Date().toLocaleString('zh-CN');
    cropAnalysisIndex.value = 0;
    try { await axios.post('/api/ai/results/analysis', { result: res.data.result }); } catch (e) {}
    startCropAnalysisCarousel();
    if (res.data.cooldown) {
      analysisCooldown.value = res.data.cooldown;
      startCooldownTimer();
    }
  } catch (err) {
    console.error('Analysis failed:', err);
    const msg = err.response?.data?.error || 'AI 分析失败，请检查配置';
    if (window.__modal) { window.__modal.showToast(msg, 'error'); }
    if (err.response?.data?.cooldown) { analysisCooldown.value = err.response.data.cooldown; startCooldownTimer(); }
  } finally {
    aiAnalyzing.value = false;
  }
}

function startCooldownTimer() {
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    analysisCooldown.value = Math.max(0, analysisCooldown.value - 1);
    if (analysisCooldown.value <= 0) clearInterval(cooldownTimer);
  }, 1000);
}

function formatCooldown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(iso) {
  if (!iso) return '';
  const time = new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `更新时间 ${time}`;
}

function formatForecastDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function getWeatherIcon(code) {
  if (code == null) return '🌤';
  if (code <= 1) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 49) return '🌫';
  if (code <= 69) return '🌧';
  if (code <= 79) return '❄️';
  if (code <= 82) return '🌧';
  if (code <= 86) return '🌨';
  return '⛈';
}

function getPriorityClass(priority) {
  if (priority === '紧急') return 'urgent';
  if (priority === '重要' || priority === '高') return 'important';
  return 'routine';
}

function getLevelClass(level) {
  if (level === '高') return 'urgent';
  if (level === '中') return 'important';
  return 'routine';
}

function getCropIcon(cropType) {
  const icons = {
    '番茄': '🍅', '黄瓜': '🥒', '辣椒': '🌶️', '茄子': '🍆',
    '草莓': '🍓', '西瓜': '🍉', '甜瓜': '🍈', '生菜': '🥬',
    '白菜': '🥬', '萝卜': '🥕', '胡萝卜': '🥕', '玉米': '🌽'
  };
  return icons[cropType] || '🌱';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

async function loadCropKnowledge(cropType) {
  if (cropKnowledgeCache.value[cropType]) return cropKnowledgeCache.value[cropType];
  try {
    const res = await axios.get(`/api/knowledge/crops/${cropType}`);
    cropKnowledgeCache.value[cropType] = res.data;
    return res.data;
  } catch (e) {
    return null;
  }
}

function getAllStages(crop) {
  try {
    const knowledge = cropKnowledgeCache.value[crop.type];
    if (knowledge?.stages) {
      return knowledge.stages.map(s => s.name).sort((a, b) => {
        const orderA = knowledge.stages.find(s => s.name === a)?.order || 0;
        const orderB = knowledge.stages.find(s => s.name === b)?.order || 0;
        return orderA - orderB;
      });
    }
    return ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
  } catch (e) {
    console.error('getAllStages error:', e);
    return ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
  }
}

function getStageTypicalDays(cropType) {
  const knowledge = cropKnowledgeCache.value[cropType];
  if (knowledge?.stages) {
    const stages = [...knowledge.stages].sort((a, b) => a.order - b.order);
    return stages.map(s => s.typical_days || 30);
  }
  return [30, 15, 20, 40, 30];
}

function getTotalCycleDays(cropType) {
  const days = getStageTypicalDays(cropType);
  return days.reduce((a, b) => a + b, 0);
}

function calculateEnhancedProgress(crop) {
  const stages = getAllStages(crop);
  const currentIdx = stages.indexOf(crop.current_stage);
  if (currentIdx === -1) return 0;

  const stageDays = getStageTypicalDays(crop.type);
  const totalDays = stageDays.reduce((a, b) => a + b, 0);

  let completedDays = 0;
  for (let i = 0; i < currentIdx; i++) {
    completedDays += stageDays[i] || 30;
  }

  const currentStageDays = stageDays[currentIdx] || 30;
  const daysInStage = crop.days_after_transplant || 0;
  const stageProgress = Math.min(Math.max(daysInStage / currentStageDays, 0), 1.5);

  completedDays += currentStageDays * stageProgress;

  return Math.min(Math.round((completedDays / totalDays) * 100), 100);
}

function getEnhancedProgress(crop) {
  try {
    return calculateEnhancedProgress(crop);
  } catch (e) {
    console.error('getEnhancedProgress error:', e);
    return 0;
  }
}

function getStageGradient(crop) {
  try {
    const gradients = {
      '育苗期': 'linear-gradient(90deg, #4caf50, #8bc34a)',
      '定植缓苗期': 'linear-gradient(90deg, #8bc34a, #cddc39)',
      '初花期': 'linear-gradient(90deg, #ffc107, #ff9800)',
      '盛果期': 'linear-gradient(90deg, #ff9800, #ff5722)',
      '采收期': 'linear-gradient(90deg, #f44336, #e91e63)'
    };
    return gradients[crop.current_stage] || 'linear-gradient(90deg, #4caf50, #8bc34a)';
  } catch (e) {
    return 'linear-gradient(90deg, #4caf50, #8bc34a)';
  }
}

function isStagePassed(crop, stageName, idx) {
  try {
    const stages = getAllStages(crop);
    const currentIdx = stages.indexOf(crop.current_stage);
    return idx < currentIdx;
  } catch (e) {
    return false;
  }
}

function calculateHarvestDate(crop) {
  if (!crop.planting_date) return null;
  const planting = new Date(crop.planting_date);
  const totalDays = getTotalCycleDays(crop.type);
  const harvest = new Date(planting.getTime() + totalDays * 24 * 60 * 60 * 1000);
  return harvest.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function getHarvestDate(crop) {
  try {
    return calculateHarvestDate(crop);
  } catch (e) {
    console.error('getHarvestDate error:', e);
    return null;
  }
}

function calculateDaysRemaining(crop) {
  if (!crop.planting_date) return '--';
  const totalDays = getTotalCycleDays(crop.type);
  const elapsed = crop.days_after_transplant || 0;
  return Math.max(totalDays - elapsed, 0);
}

function getDaysRemaining(crop) {
  try {
    return calculateDaysRemaining(crop);
  } catch (e) {
    console.error('getDaysRemaining error:', e);
    return '--';
  }
}

function calculateHealthStatus(crop) {
  let score = 75;

  if (crop.latestRecord) {
    const height = parseFloat(crop.latestRecord['株高(cm)']);
    const heightThresholds = getHeightThresholds(crop.type, crop.current_stage);

    if (!isNaN(height)) {
      if (height > 0 && height < heightThresholds.min) {
        score -= 20;
      } else if (height > heightThresholds.max) {
        score += 10;
      } else {
        score += 5;
      }
    }
  }

  if (crop.days_after_transplant != null && crop.days_after_transplant >= 0) {
    const stageDays = getStageTypicalDays(crop.type);
    const currentIdx = getAllStages(crop).indexOf(crop.current_stage);
    if (currentIdx >= 0 && stageDays[currentIdx]) {
      const ratio = (crop.days_after_transplant || 0) / stageDays[currentIdx];
      if (ratio > 1.5) {
        score -= 15;
      } else if (ratio < 0.3 && crop.days_after_transplant > 5) {
        score -= 10;
      } else if (ratio >= 0.5 && ratio <= 1.0) {
        score += 5;
      }
    }
  }

  const prediction = aiPredictionsMap[crop.id];
  if (prediction?.risk_level === 'high') {
    score -= 25;
  } else if (prediction?.risk_level === 'medium') {
    score -= 10;
  } else if (prediction?.risk_level === 'low') {
    score += 10;
  }

  if (score >= 80) return { icon: '🌿', text: '优良', class: 'excellent' };
  if (score >= 65) return { icon: '🌱', text: '正常', class: 'normal' };
  if (score >= 45) return { icon: '⚠️', text: '注意', class: 'warning' };
  return { icon: '🔴', text: '异常', class: 'danger' };
}

function getHeightThresholds(cropType, stage) {
  const thresholds = {
    '番茄': {
      '育苗期': { min: 5, max: 15 },
      '定植缓苗期': { min: 15, max: 35 },
      '初花期': { min: 40, max: 80 },
      '盛果期': { min: 100, max: 200 },
      '采收期': { min: 150, max: 250 }
    },
    '黄瓜': {
      '育苗期': { min: 5, max: 12 },
      '定植缓苗期': { min: 12, max: 25 },
      '初花期': { min: 25, max: 50 },
      '盛果期': { min: 50, max: 120 },
      '采收期': { min: 100, max: 180 }
    },
    '辣椒': {
      '育苗期': { min: 5, max: 12 },
      '定植缓苗期': { min: 12, max: 25 },
      '初花期': { min: 25, max: 45 },
      '盛果期': { min: 45, max: 80 },
      '采收期': { min: 60, max: 100 }
    },
    '草莓': {
      '育苗期': { min: 3, max: 8 },
      '定植缓苗期': { min: 8, max: 15 },
      '初花期': { min: 12, max: 20 },
      '盛果期': { min: 18, max: 30 },
      '采收期': { min: 20, max: 35 }
    }
  };

  return thresholds[cropType]?.[stage] || { min: 10, max: 50 };
}

function getHealthStatus(crop) {
  try {
    return calculateHealthStatus(crop);
  } catch (e) {
    console.error('getHealthStatus error:', e);
    return { icon: '🌱', text: '正常', class: 'normal' };
  }
}

function getHealthClass(crop) {
  try {
    return getHealthStatus(crop).class;
  } catch (e) {
    return 'normal';
  }
}

function getHealthTooltip(crop) {
  try {
    const status = getHealthStatus(crop);
    const tooltips = {
      excellent: '生长状态优良，继续保持！',
      normal: '生长状态正常，注意日常管理',
      warning: '需要注意观察，可能存在潜在问题',
      danger: '状态异常，建议立即检查并采取相应措施'
    };
    return tooltips[status.class] || '';
  } catch (e) {
    return '';
  }
}

function buildStageTimeline(crop) {
  const knowledge = cropKnowledgeCache.value[crop.type];
  if (!knowledge?.stages) return [];

  const stages = [...knowledge.stages].sort((a, b) => a.order - b.order);
  const plantingDate = crop.planting_date ? new Date(crop.planting_date) : null;

  let currentDate = plantingDate ? new Date(plantingDate.getTime()) : new Date();
  const currentIdx = stages.findIndex(s => s.name === crop.current_stage);

  return stages.map((stage, idx) => {
    const startDate = plantingDate ? new Date(currentDate.getTime()) : null;
    if (plantingDate) {
      currentDate.setDate(currentDate.getDate() + (stage.typical_days || 30));
    }
    const endDate = plantingDate ? new Date(currentDate.getTime()) : null;

    return {
      name: stage.name,
      startDate,
      endDate,
      typicalDays: stage.typical_days || 30,
      tasks: stage.key_points ? stage.key_points.split('\n').filter(t => t.trim()) : [],
      completed: idx < currentIdx,
      current: idx === currentIdx
    };
  });
}

function getStageTimeline(crop) {
  try {
    return buildStageTimeline(crop);
  } catch (e) {
    console.error('getStageTimeline error:', e);
    return [];
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function loadAiPredictionsFromCache() {
  try {
    const cached = localStorage.getItem(AI_CACHE_KEY);
    if (!cached) return false;

    const { date, timestamp, predictions } = JSON.parse(cached);
    const today = getTodayString();

    if (date === today) {
      Object.keys(predictions).forEach(cropId => {
        aiPredictionsMap[cropId] = predictions[cropId];
        if (timestamp) {
          aiPredictionTimestampsMap[cropId] = timestamp;
        }
      });
      console.log(`✓ Loaded ${Object.keys(predictions).length} AI predictions from localStorage cache (today, updated at ${timestamp})`);
      return true;
    }

    localStorage.removeItem(AI_CACHE_KEY);
    return false;
  } catch (e) {
    console.warn('Failed to load AI cache:', e);
    return false;
  }
}

function saveAiPredictionsToCache() {
  try {
    const today = getTodayString();
    const data = {
      date: today,
      timestamp: new Date().toISOString(),
      predictions: {}
    };

    Object.keys(aiPredictionsMap).forEach(cropId => {
      data.predictions[cropId] = aiPredictionsMap[cropId];
    });

    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(data));
    console.log(`✓ Saved ${Object.keys(data.predictions).length} AI predictions to localStorage cache at ${data.timestamp}`);
  } catch (e) {
    console.warn('Failed to save AI cache:', e);
  }
}

const aiPredictionTimestampsMap = reactive({});
const aiTooltipVisibleMap = reactive({});

function getAiPredictionTimestamp(crop) {
  return aiPredictionTimestampsMap[crop.id] || null;
}

function formatAiTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚更新';
    if (diffMins < 60) return `${diffMins}分钟前更新`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前更新`;

    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function formatFullTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

function formatDaysAfterTransplant(days) {
  if (days === undefined || days === null) return '定植当天';
  if (days <= 0) return '定植当天';
  if (days === 1) return '第1天';
  return `第${days}天`;
}

function getFullAiPredictionTooltip(crop) {
  try {
    const prediction = getCropAiPrediction(crop);
    if (!prediction) return '';

    const parts = [];

    if (prediction.status) parts.push(`状态：${prediction.status}`);
    if (prediction.summary) parts.push(`分析：${prediction.summary}`);
    if (prediction.risk_level) {
      const riskMap = { low: '低', medium: '中', high: '高' };
      parts.push(`风险等级：${riskMap[prediction.risk_level] || prediction.risk_level}`);
    }
    if (prediction.recommendations?.length) {
      parts.push(`建议：\n${prediction.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
    }
    if (prediction.next_milestone) parts.push(`下一阶段目标：${prediction.next_milestone}`);

    return parts.join('\n\n');
  } catch (e) {
    return '';
  }
}

function toggleAiTooltip(crop) {
  aiTooltipVisibleMap[crop.id] = !aiTooltipVisibleMap[crop.id];
}

function isAiTooltipVisible(crop) {
  return !!aiTooltipVisibleMap[crop.id];
}

function getRiskLabel(level) {
  const map = { low: '低风险', medium: '中等风险', high: '高风险' };
  return map[level] || '未知';
}

function handleRenderError(event) {
  console.error('Render error in growth section:', event);
  hasRenderError.value = true;
}

async function fetchAiPrediction(crop) {
  if (!config.value.ai?.enabled) return;
  if (aiPredictionLoadingMap[crop.id]) return;

  aiPredictionLoadingMap[crop.id] = true;

  try {
    const res = await axios.post('/api/ai/predict-growth', {
      crop_id: crop.id,
      crop_type: crop.type,
      variety_name: crop.variety_name,
      current_stage: crop.current_stage,
      days_after_transplant: crop.days_after_transplant,
      latest_record: crop.latestRecord,
      weather: weather.value?.merged
    });

    if (res.data.cached) {
      console.log(`Crop ${crop.id}: Using cached prediction from today`);
      aiPredictionsMap[crop.id] = res.data.prediction;
    } else {
      aiPredictionsMap[crop.id] = res.data.prediction;
      aiPredictionTimestampsMap[crop.id] = new Date().toISOString();
      saveAiPredictionsToCache();
    }
  } catch (err) {
    console.error('AI prediction failed for crop:', crop.id, err);
    if (window.__modal && err.response?.data?.error) {
      window.__modal.showToast(`${crop.type} AI预测失败: ${err.response.data.error}`, 'error');
    }
  } finally {
    aiPredictionLoadingMap[crop.id] = false;
  }
}

function getCropAiPrediction(crop) {
  try {
    return aiPredictionsMap[crop.id] ?? null;
  } catch (e) {
    return null;
  }
}

function isCropAiLoading(crop) {
  try {
    return !!aiPredictionLoadingMap[crop.id];
  } catch (e) {
    return false;
  }
}

async function loadAllCropKnowledge() {
  const crops = activeCrops.value;
  const uniqueTypes = [...new Set(crops.map(c => c.type))];

  await Promise.allSettled(
    uniqueTypes.map(type => loadCropKnowledge(type))
  );
}

function startDailyAiPrediction() {
  if (dailyAiTimer) clearInterval(dailyAiTimer);

  dailyAiTimer = setInterval(async () => {
    const crops = activeCrops.value;
    for (const crop of crops) {
      await fetchAiPrediction(crop);
    }
  }, 24 * 60 * 60 * 1000);
}

async function initialAiPrediction() {
  if (isInitializingAi) return;
  isInitializingAi = true;

  try {
    const crops = activeCrops.value;
    for (const crop of crops) {
      if (config.value.ai?.enabled) {
        await fetchAiPrediction(crop);
        await nextTick();
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  } catch (err) {
    console.error('Initial AI prediction failed:', err);
  } finally {
    isInitializingAi = false;
  }
}

function getProgress(crop) {
  return getEnhancedProgress(crop);
}

function getOpIcon(type) {
  const icons = { '施肥': '🌿', '打药': '💧', '灌溉': '💧', '整枝打杈': '✂️', '通风': '🌬', '授粉': '🌸', '采收': '🥬', '环境记录': '🌡', '其他': '📝' };
  return icons[type] || '📝';
}

async function advanceStage(crop) {
  let ok = true;
  if (window.__modal) {
    ok = await window.__modal.showConfirm(`确认将 ${crop.type} ${crop.variety_name} 推进到下一阶段？`, '推进阶段');
  }
  if (!ok) return;
  try {
    await axios.post(`/api/crops/${crop.id}/advance-stage`);
    await store.fetchConfig();
  } catch (err) {
    if (window.__modal) { window.__modal.showToast(err.response?.data?.error || '推进失败', 'error'); }
  }
}


onMounted(() => {
  loadData();

  loadAiPredictionsFromCache();

  setTimeout(async () => {
    try {
      await loadAllCropKnowledge();
      startDailyAiPrediction();
      await initialAiPrediction();
    } catch (err) {
      console.error('Background AI update failed:', err);
    }
  }, 2000);
});

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer);
  if (carouselTimer) clearInterval(carouselTimer);
  if (cropAnalysisTimer) clearInterval(cropAnalysisTimer);
  if (dailyAiTimer) clearInterval(dailyAiTimer);
});
</script>

<style scoped>

.growth-error-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 20px;
  background: var(--bg-card);
  border-radius: var(--radius);
  border: 1px solid #ff9800;
  color: #ff9800;
  font-size: 14px;
}

.growth-error-fallback .error-icon {
  font-size: 24px;
}


.weather-card {
  background: linear-gradient(135deg, #2d7d46, #43a047);
  color: white;
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 8px;
}

/* Top row: Temperature + City + Time */
.weather-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.weather-temp-compact {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.temp-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
}

.weather-desc {
  font-size: 14px;
  opacity: 0.9;
}

.weather-right-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.weather-city {
  font-size: 12px;
  opacity: 0.85;
}

.update-time-inline {
  font-size: 10px;
  opacity: 0.6;
}

/* Middle row: Weather details inline */
.weather-middle-row {
  margin-bottom: 6px;
}

.weather-details-inline {
  display: flex;
  gap: 12px;
  font-size: 12px;
  opacity: 0.9;
}

.weather-city {
  font-size: 14px;
  opacity: 0.8;
}

.forecast-row { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
  display: flex;
  gap: 8px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.forecast-day {
  flex: 0 0 auto;  /* Don't stretch, allow scroll */
  min-width: 60px;   /* Minimum width for each day */
  text-align: center;
  font-size: 11px;
}

.forecast-icon { font-size: 18px; margin: 2px 0; }
.forecast-temp { opacity: 0.9; font-size: 10px; white-space: nowrap; }

.source-badges {
  display: flex;
  gap: 6px;
}

.source-badges .badge {
  font-size: 10px;
  padding: 2px 6px;
}

/* Bottom row: Sources + Spray */
.weather-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.15);
}

.spray-window-inline {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  opacity: 0.9;
}

.spray-icon { margin-right: 2px; }

.weather-unavailable {
  text-align: center;
  padding: 40px 0;
  opacity: 0.8;
}

.today-ops-card { border-left: 4px solid var(--primary); }

.today-op-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
}

.today-op-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: white;
  flex-shrink: 0;
}

.today-op-title { font-weight: 600; font-size: 14px; }
.today-op-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.analysis-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.analysis-btn {
  flex: 1;
  padding: 14px;
  font-size: 16px;
  border-radius: var(--radius);
}

.analysis-results { margin-bottom: 12px; }

.analysis-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.analysis-box {
  padding: 10px;
  transition: all 0.3s ease;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.analysis-title-inline {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  line-height: 1.3;
  word-break: break-word;
}

.badge-warning {
  background: rgba(244, 67, 54, 0.1);
  color: var(--danger, #f44336);
}

.analysis-box .decision-title {
  font-size: 13px;
  margin-bottom: 4px;
  line-height: 1.3;
}

.decision-actions.compact {
  margin: 4px 0 0 14px;
  padding: 0;
  font-size: 11px;
  line-height: 1.4;
}

.decision-actions.compact li {
  margin-bottom: 1px;
}

.decision-actions.compact .more {
  color: var(--text-secondary);
  font-style: italic;
}

.decision-summary.compact {
  font-size: 11px;
  margin-bottom: 4px;
  word-break: break-word;
  line-height: 1.4;
}

.crop-analysis-carousel { padding: 10px; }

.alert-crop-tags.single-tag { margin: 4px 0 2px; }

.crop-risk-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  padding: 4px 8px;
  background: rgba(255, 152, 0, 0.06);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
}

.crop-risk-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  color: white;
}

.crop-risk-badge.urgent { background: #f44336; }
.crop-risk-badge.important { background: #ff9800; }
.crop-risk-badge.routine { background: #4caf50; }

.crop-risk-summary {
  color: var(--text-secondary);
  word-break: break-word;
}

.decision-reason.compact {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 4px;
  line-height: 1.3;
  word-break: break-word;
}

.ai-timestamp { font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; text-align: right; }
.analysis-remaining {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
}

.decision-section { margin-bottom: 10px; }

.decision-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.decision-carousel {
  border-left: 4px solid var(--success);
  padding: 12px;
  transition: all 0.3s ease;
}

.decision-carousel.urgent { border-left-color: var(--danger); }
.decision-carousel.important { border-left-color: var(--accent); }
.decision-carousel.safety-card { border-left-color: var(--warning); background: #fffde7; }

.carousel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.update-time {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
  padding-right: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.carousel-dots {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border, #e0e0e0);
  cursor: pointer;
  transition: all 0.2s ease;
}

.dot.active {
  background: var(--primary, #4caf50);
  transform: scale(1.2);
}

.dot:hover {
  background: var(--primary, #4caf50);
  opacity: 0.7;
}

.decision-type-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(45, 125, 70, 0.1);
  border-radius: 10px;
  font-size: 11px;
  color: var(--primary);
  margin-bottom: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.decision-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; word-break: break-word; }
.decision-summary { font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.decision-actions { padding-left: 16px; font-size: 13px; margin: 6px 0; }
.decision-reason, .decision-trigger { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.decision-warnings { margin-top: 6px; }
.warning-item {
  font-size: 12px;
  color: var(--accent);
  word-break: break-word;
  line-height: 1.5;
}

.alert-crop-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
}

.alert-crop-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: rgba(76, 175, 80, 0.08);
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 12px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.decision-crop-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.crop-info-greenhouse,
.crop-info-crop {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg);
  border-radius: 8px;
  white-space: nowrap;
}

.growth-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.growth-grid > .growth-card {
  margin-bottom: 0;
}

.growth-card {
  padding: 5px 6px;
}

.growth-card.enhanced {
  padding: 5px 6px;
  position: relative;
}

.growth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1px;
}

.crop-info-main {
  display: flex;
  gap: 4px;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.crop-icon {
  font-size: 14px;
  line-height: 1;
  flex-shrink: 0;
}

.growth-name { font-weight: 700; font-size: 12px; display: block; line-height: 1.2; }

.growth-meta-row {
  display: flex;
  gap: 3px;
  align-items: center;
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 0;
  flex-wrap: wrap;
}

.meta-separator {
  color: var(--border);
  font-size: 9px;
}

.planting-date, .harvest-date {
  white-space: nowrap;
}

.health-badge {
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: 3px;
}

.health-badge.excellent { background: #e8f5e9; color: #2e7d32; }
.health-badge.normal { background: #fff3e0; color: #ef6c00; }
.health-badge.warning { background: #fff8e1; color: #f9a825; }
.health-badge.danger { background: #ffebee; color: #c62828; }

.stage-progress-section {
  margin: 1px 0;
}

.stage-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1px;
}

.stage-name {
  font-size: 10px;
  color: var(--primary);
  font-weight: 600;
}

.days-count {
  font-size: 9px;
  color: var(--text-secondary);
}

.progress-container-enhanced {
  position: relative;
  margin-bottom: 2px;
}

.progress-bar-enhanced {
  position: relative;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: visible;
}

.progress-fill-animated {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.progress-fill-animated::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.4) 50%,
    transparent 100%
  );
  animation: shimmer 2.5s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}

.stage-marker-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  border: 1.5px solid #ccc;
  transition: all 0.3s ease;
  z-index: 2;
  cursor: default;
}

.stage-marker-dot.passed {
  border-color: #4caf50;
  background: #4caf50;
  box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.15);
}

.stage-marker-dot.active {
  border-color: var(--primary);
  background: white;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.25);
  transform: translate(-50%, -50%) scale(1.2);
  z-index: 3;
}

.stage-marker-dot.future {
  border-color: #ddd;
  opacity: 0.7;
}

.progress-stats {
  display: flex;
  gap: 4px;
  justify-content: center;
  font-size: 9px;
  color: var(--text-secondary);
  align-items: center;
}

.stats-separator {
  color: var(--border);
}

.growth-metrics-compact {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-top: 1px;
  padding: 2px 0;
  border-top: 1px solid var(--border);
  border-bottom: none;
}

.ai-prediction {
  position: relative;
}

.metric-item {
  display: flex;
  gap: 2px;
  align-items: center;
  font-size: 9px;
  color: var(--text-secondary);
}

.metric-icon {
  font-size: 10px;
  line-height: 1;
}

.metric-value {
  font-weight: 500;
  color: var(--text);
}

.ai-prediction .prediction-text {
  color: var(--primary);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
}

.ai-prediction .ai-prediction-content {
  display: flex;
  align-items: center;
  gap: 3px;
}

.ai-prediction .ai-update-time {
  color: var(--text-secondary);
  font-size: 9px;
  opacity: 0.8;
  white-space: nowrap;
}

.growth-metrics-compact .stage-action-inline {
  margin-left: auto;
}

.stage-action-inline .btn {
  font-size: 9px;
  padding: 2px 6px;
}

.ai-prediction-content {
  cursor: pointer;
}

.ai-expand-hint {
  font-size: 9px;
  color: var(--primary);
  opacity: 0.7;
  margin-left: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .ai-expand-hint::after { content: ' 👆'; }
}

@media (hover: none) and (pointer: coarse) {
  .ai-expand-hint::after { content: ' ▸'; }
}

.ai-tooltip-mobile {
  position: fixed;
  left: 16px;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  z-index: 9999;
  max-height: 80vh;
  overflow-y: auto;
}

.tooltip-close-inline {
  display: block;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: right;
}

.tooltip-close-inline:hover {
  background: rgba(0, 0, 0, 0.02);
}

.ai-tooltip-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.status-text {
  font-size: 15px;
  font-weight: 700;
  color: var(--primary);
}

.risk-badge-inline {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.risk-low { background: #E8F5E9; color: #2E7D32; }
.risk-medium { background: #FFF3E0; color: #EF6C00; }
.risk-high { background: #FFEBEE; color: #C62828; }

.analysis-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  padding: 8px 10px;
  background: rgba(255, 152, 0, 0.06);
  border-radius: 6px;
  border-left: 3px solid #FF9800;
}

.suggestions-list-compact {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.suggestions-list-compact li {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
  padding: 6px 8px 6px 14px;
  position: relative;
}

.suggestions-list-compact li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: var(--primary);
  font-weight: bold;
}

.milestone-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
  padding: 8px 10px;
  background: rgba(156, 39, 176, 0.05);
  border-radius: 6px;
  border-left: 3px solid #9C27B0;
}

.ai-loading .metric-value {
  color: var(--accent);
  font-style: italic;
}

.stage-timeline-details {
  margin-top: 1px;
}

.timeline-summary {
  font-size: 9px;
  color: var(--primary);
  cursor: pointer;
  padding: 1px 0;
  user-select: none;
  font-weight: 500;
}

.timeline-summary:hover {
  color: var(--primary-dark, #388e3c);
}

.timeline-content {
  padding: 2px 0;
  margin-top: 1px;
  border-left: 2px solid var(--border);
  margin-left: 8px;
  padding-left: 10px;
}

.timeline-stage-item {
  position: relative;
  padding: 2px 0;
  opacity: 0.6;
  transition: opacity 0.3s ease;
}

.timeline-stage-item.completed {
  opacity: 1;
}

.timeline-stage-item.current {
  opacity: 1;
  background: rgba(76, 175, 80, 0.05);
  margin: 0 -6px;
  padding: 3px 6px;
  border-radius: 4px;
}

.timeline-marker {
  position: absolute;
  left: -15px;
  top: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
  border: 1.5px solid white;
}

.timeline-stage-item.completed .timeline-marker {
  background: #4caf50;
}

.timeline-stage-item.current .timeline-marker {
  background: var(--primary);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
}

.timeline-info {
  margin-left: 2px;
}

.timeline-stage-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0;
}

.timeline-stage-meta {
  font-size: 8px;
  color: var(--text-secondary);
  margin-bottom: 1px;
}

.timeline-tasks {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.task-tag {
  font-size: 9px;
  padding: 1px 4px;
  background: rgba(76, 175, 80, 0.08);
  color: var(--primary);
  border-radius: 6px;
  border: 1px solid rgba(76, 175, 80, 0.15);
}

.growth-actions {
  margin-top: 8px;
  text-align: right;
}

.safety-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.safety-item:last-child { border-bottom: none; }
.safety-icon { color: var(--warning); font-size: 16px; }

.recent-op-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.recent-op-item:last-child { border-bottom: none; }
.op-icon { font-size: 16px; }
.op-desc { flex: 1; }
.op-date { color: var(--text-secondary); font-size: 12px; }

.recent-ops-card .recent-ops-scroll {
  max-height: 216px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}

.recent-ops-card .recent-ops-scroll::-webkit-scrollbar {
  width: 4px;
}

.recent-ops-card .recent-ops-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}

.recent-ops-card .recent-ops-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.decision-section, .growth-section { margin-bottom: 12px; }
.safety-interval-card { border-left: 4px solid var(--warning); margin-bottom: 12px; }

/* Mobile optimization */
@media (max-width: 480px) {
  .weather-card { padding: 10px; margin-bottom: 6px; }
  .temp-value { font-size: 30px; }
  .weather-desc { font-size: 12px; }
  .weather-city { font-size: 11px; }
  .update-time-inline { font-size: 9px; }
  .weather-details-inline { gap: 8px; font-size: 11px; }
  .forecast-row { gap: 6px; margin-top: 6px; padding-top: 4px; }
  .forecast-day { font-size: 9px; min-width: 52px; }
  .forecast-icon { font-size: 14px; }
  .forecast-temp { font-size: 9px; }
  .weather-bottom-row { margin-top: 6px; padding-top: 4px; }
  .spray-window-inline { font-size: 10px; }

  .card { padding: 8px; margin-bottom: 6px; }
  .decision-carousel { padding: 8px; }
  .analysis-box { padding: 8px; }
  .section-title { font-size: 13px; margin-bottom: 5px; padding: 2px 0; }

  .decision-summary.compact { font-size: 11px; line-height: 1.3; margin: 3px 0; }
  .decision-actions.compact li { font-size: 11px; padding: 1px 0; }
  .update-time { font-size: 9px; }

  .alert-crop-tags { gap: 4px; margin: 4px 0; }
  .alert-crop-tag { font-size: 10px; padding: 2px 6px; }
  .decision-crop-info { gap: 4px; margin-bottom: 4px; }
  .crop-info-greenhouse, .crop-info-crop { font-size: 10px; padding: 1px 6px; }

  .growth-grid {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .growth-card { padding: 4px; }
  .growth-card.enhanced { padding: 4px; }
  .growth-header { margin-bottom: 1px; }
  .growth-stage, .stage-name { font-size: 9px; margin: 1px 0; }
  .crop-icon { font-size: 13px; }
  .growth-meta-row { font-size: 8px; gap: 2px; }
  .health-badge { font-size: 8px; padding: 1px 4px; }
  .stage-label-row { margin-bottom: 1px; }
  .days-count { font-size: 8px; }
  .progress-bar-enhanced { height: 3px; }
  .stage-marker-dot { width: 7px; height: 7px; border-width: 1.5px; }
  .stage-marker-dot.active { transform: translate(-50%, -50%) scale(1.15); }
  .progress-stats { font-size: 8px; gap: 3px; }
  .growth-metrics-compact { gap: 4px; margin-top: 1px; padding: 1px 0; }
  .metric-item { font-size: 8px; gap: 1px; }
  .metric-icon { font-size: 9px; }
  .timeline-summary { font-size: 8px; }
  .timeline-stage-name { font-size: 9px; }
  .timeline-stage-meta { font-size: 7px; }
  .task-tag { font-size: 7px; padding: 1px 3px; }
}
</style>
