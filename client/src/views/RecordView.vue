<template>
  <div class="page record-page">
    <h2>操作记录</h2>

    <!-- Date range picker and search -->
    <div class="filter-bar">
      <div class="date-range-picker">
        <label class="filter-label">日期范围：</label>
        <input type="date" v-model="dateRange.start" class="date-input" />
        <span class="date-separator">至</span>
        <input type="date" v-model="dateRange.end" class="date-input" />
        <button v-if="dateRange.start || dateRange.end" class="btn-clear" @click="clearDateRange">✕</button>
      </div>
      <div class="search-box">
        <input type="text" v-model="searchKeyword" class="search-input" placeholder="搜索操作类型、作物、备注..." />
      </div>
    </div>

    <!-- Filter chips -->
    <div class="chip-scroll" @wheel.prevent="onChipScroll">
      <div class="chip-group">
        <button class="chip template-chip" :class="{ active: showQuickTemplate }" @click="showQuickTemplate = !showQuickTemplate">
          📋 模板
        </button>
        <button v-for="t in filterTypes" :key="t.value" class="chip" :class="{ active: activeFilter === t.value }" @click="activeFilter = t.value">
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Quick template panel -->
    <div v-if="showQuickTemplate" class="quick-template-panel">
      <div v-if="templates.length === 0" class="empty-template">暂无模板，请先在新增操作中保存模板</div>
      <div v-else class="quick-template-list">
        <div v-for="tpl in templates" :key="tpl.id" class="quick-template-item" @click="selectQuickTemplate(tpl)">
          <span class="template-icon">{{ getOpIcon(tpl.type) }}</span>
          <span class="template-name">{{ tpl.name }}</span>
          <span class="template-type">{{ tpl.type }}</span>
        </div>
      </div>
    </div>

    <!-- Crop selection for template -->
    <div v-if="selectedTemplate" class="template-crop-select">
      <div class="template-crop-header">
        <span>选择作物应用模板「{{ selectedTemplate.name }}」</span>
        <button class="btn-close" @click="selectedTemplate = null">✕</button>
      </div>
      <select v-model="templateCropId" class="form-select">
        <option value="">请选择作物</option>
        <option v-for="crop in activeCrops" :key="crop.id" :value="crop.id">
          {{ crop.greenhouse_name }} - {{ crop.type }} {{ crop.variety_name }}
        </option>
      </select>
      <button class="btn btn-primary full-width" @click="applyQuickTemplate" :disabled="!templateCropId">确认应用</button>
    </div>

    <!-- Stats toggle -->
    <div class="view-toggle">
      <button class="chip" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">列表</button>
      <button class="chip" :class="{ active: viewMode === 'stats' }" @click="viewMode = 'stats'">统计</button>
    </div>

    <!-- List view -->
    <div v-if="viewMode === 'list'">
      <div v-for="(group, date) in paginatedGroupedOps" :key="date" class="date-group">
        <div class="date-header">{{ date }}</div>
        <div v-for="op in group" :key="op.id" class="card op-card">
          <div class="op-calendar">
            <div class="calendar-month">{{ getMonthName(op.date) }}</div>
            <div class="calendar-day">{{ getDay(op.date) }}</div>
          </div>
          <div class="op-body">
            <div class="op-head">
              <span class="op-icon">{{ getOpIcon(op.type) }}</span>
              <span class="op-type">{{ op.type }}</span>
              <span class="op-crop">{{ op.crop_name }} · {{ op.greenhouse_name }}</span>
              <button class="op-delete" @click.stop="deleteOperation(op)" title="删除">🗑</button>
            </div>
            <div v-if="formatDetails(op).length > 0" class="op-tags">
              <span v-for="(d, i) in formatDetails(op)" :key="i" class="op-tag">
                {{ d.label }}<strong>{{ d.value }}</strong>
              </span>
            </div>
            <div v-if="op.note" class="op-note">{{ op.note }}</div>
            <div v-if="op.warnings?.length > 0" class="op-warnings">
              <div v-for="(w, i) in op.warnings" :key="i" class="warning-item">⚠ {{ w }}</div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="Object.keys(paginatedGroupedOps).length === 0" class="empty">暂无操作记录</div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页（共 {{ totalFilteredCount }} 条）</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
      </div>
    </div>

    <!-- Stats view -->
    <div v-if="viewMode === 'stats'" class="card">
      <div class="stats-header">
        <button class="chip" :class="{ active: statsPeriod === 'week' }" @click="statsPeriod = 'week'">本周</button>
        <button class="chip" :class="{ active: statsPeriod === 'month' }" @click="statsPeriod = 'month'">本月</button>
      </div>
      <div v-for="(count, type) in stats" :key="type" class="stat-bar" v-show="type !== 'total'">
        <span class="stat-label">{{ type }}</span>
        <div class="stat-bar-track">
          <div class="stat-bar-fill" :style="{ width: getBarWidth(count) + '%' }"></div>
        </div>
        <span class="stat-count">{{ count }}</span>
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" @click="showSheet = true">+</button>

    <!-- Bottom sheet for adding new operation -->
    <div v-if="showSheet" class="bottom-sheet-overlay" @click="showSheet = false">
      <div class="bottom-sheet" @click.stop>
        <div class="bottom-sheet-handle"></div>
        <h3>新增操作记录</h3>

        <div v-if="sheetError" class="error-bar">{{ sheetError }}</div>

        <!-- Step 1: Select crop -->
        <div v-if="sheetStep === 1" class="form-group">
          <label class="form-label">选择棚区+作物</label>
          <select v-model="newOp.crop_id" class="form-select">
            <option value="">请选择</option>
            <option v-for="crop in activeCrops" :key="crop.id" :value="crop.id">
              {{ crop.greenhouse_name }} - {{ crop.type }} {{ crop.variety_name }}
            </option>
          </select>
        </div>

        <!-- Step 2: Date -->
        <div v-if="sheetStep === 2" class="form-group">
          <label class="form-label">日期</label>
          <input type="date" v-model="newOp.date" class="form-input" />
        </div>

        <!-- Step 3: Operation type -->
        <div v-if="sheetStep === 3" class="form-group">
          <label class="form-label">操作类型</label>
          <div class="type-grid">
            <button v-for="t in opTypes" :key="t.name" class="type-card" :class="{ selected: newOp.type === t.name, disabled: t.disabled }" @click="!t.disabled && (newOp.type = t.name)" :title="t.disabledReason || ''">
              <span class="type-icon">{{ t.icon }}</span>
              <span class="type-name">{{ t.name }}</span>
            </button>
          </div>
        </div>

        <!-- Step 4: Details (dynamic per type) -->
        <div v-if="sheetStep === 4">
          <!-- 施肥 -->
          <div v-if="newOp.type === '施肥'">
            <div class="form-group">
              <label class="form-label">肥料名称</label>
              <select v-model="newOp.details.fertilizer_name" class="form-select">
                <option value="">请选择</option>
                <option v-for="f in fertilizerOptions" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">用量</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('dosage', -5, 0, 9999)">-</button>
                <span class="stepper-value">{{ newOp.details.dosage || 0 }}</span>
                <button class="stepper-btn" @click="stepDetail('dosage', 5, 0, 9999)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">单位</label>
              <select v-model="newOp.details.unit" class="form-select">
                <option v-for="u in ['g/亩', 'kg/亩', 'ml/亩', '倍液']" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <!-- 打药 -->
          <div v-if="newOp.type === '打药'">
            <div class="form-group">
              <label class="form-label">农药名称</label>
              <select v-model="newOp.details.pesticide_name" class="form-select" @change="onPesticideSelect">
                <option value="">请选择</option>
                <option v-for="p in pesticideOptions" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">用量</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('dosage', -5, 0, 9999)">-</button>
                <span class="stepper-value">{{ newOp.details.dosage || 0 }}</span>
                <button class="stepper-btn" @click="stepDetail('dosage', 5, 0, 9999)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">单位</label>
              <select v-model="newOp.details.unit" class="form-select">
                <option v-for="u in ['g/亩', 'ml/亩', '倍液']" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">防治对象</label>
              <select v-model="newOp.details.target" class="form-select">
                <option value="">请选择</option>
                <option v-for="d in diseaseOptions" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div v-if="newOp.details.safety_interval" class="info-box">
              安全间隔期：{{ newOp.details.safety_interval }}天
            </div>
          </div>

          <!-- 灌溉 -->
          <div v-if="newOp.type === '灌溉'">
            <div class="form-group">
              <label class="form-label">时长 (分钟)</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('duration', -5, 0, 999)">-</button>
                <span class="stepper-value">{{ newOp.details.duration || 30 }}</span>
                <button class="stepper-btn" @click="stepDetail('duration', 5, 0, 999)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">方式</label>
              <select v-model="newOp.details.method" class="form-select">
                <option v-for="m in ['滴灌', '喷灌', '沟灌', '人工']" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
          </div>

          <!-- 整枝打杈 -->
          <div v-if="newOp.type === '整枝打杈'">
            <div class="form-group">
              <label class="form-label">操作内容</label>
              <select v-model="newOp.details.action" class="form-select">
                <option v-for="a in ['打杈', '落蔓', '疏叶', '打顶', '摘心']" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
          </div>

          <!-- 通风 -->
          <div v-if="newOp.type === '通风'">
            <div class="form-group">
              <label class="form-label">操作</label>
              <select v-model="newOp.details.action" class="form-select">
                <option v-for="a in ['开', '关', '调整']" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">通风口</label>
              <select v-model="newOp.details.vent_position" class="form-select">
                <option v-for="v in ['顶部', '侧面', '全部']" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
          </div>

          <!-- 授粉 -->
          <div v-if="newOp.type === '授粉'">
            <div class="form-group">
              <label class="form-label">方式</label>
              <select v-model="newOp.details.method" class="form-select">
                <option v-for="m in ['人工授粉', '熊蜂', '震荡器']" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
          </div>

          <!-- 采收 -->
          <div v-if="newOp.type === '采收'">
            <div class="form-group">
              <label class="form-label">采收果数</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('fruit_count', -1, 0, 100)">-</button>
                <span class="stepper-value">{{ newOp.details.fruit_count || 0 }}</span>
                <button class="stepper-btn" @click="stepDetail('fruit_count', 1, 0, 100)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">采收重量</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('weight', -0.5, 0, 9999)">-</button>
                <span class="stepper-value">{{ newOp.details.weight || 0 }}</span>
                <button class="stepper-btn" @click="stepDetail('weight', 0.5, 0, 9999)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">单位</label>
              <select v-model="newOp.details.weight_unit" class="form-select">
                <option v-for="u in ['斤', '公斤']" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
          </div>

          <!-- 环境记录 -->
          <div v-if="newOp.type === '环境记录'">
            <div class="form-group">
              <label class="form-label">棚内温度 (°C)</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('temp', -1, -10, 60)">-</button>
                <span class="stepper-value">{{ newOp.details.temp || 25 }}</span>
                <button class="stepper-btn" @click="stepDetail('temp', 1, -10, 60)">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">棚内湿度 (%)</label>
              <div class="stepper">
                <button class="stepper-btn" @click="stepDetail('humidity', -5, 0, 100)">-</button>
                <span class="stepper-value">{{ newOp.details.humidity || 60 }}</span>
                <button class="stepper-btn" @click="stepDetail('humidity', 5, 0, 100)">+</button>
              </div>
            </div>
          </div>

          <!-- 其他 -->
          <div v-if="newOp.type === '其他'">
            <div class="form-group">
              <label class="form-label">操作描述</label>
              <select v-model="newOp.details.description" class="form-select">
                <option value="">请选择</option>
                <option v-for="d in otherDescOptions" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Step 5: Note -->
        <div v-if="sheetStep === 5" class="form-group">
          <label class="form-label">备注 (可选，最多50字)</label>
          <input v-model="newOp.note" class="form-input" maxlength="50" placeholder="备注（最多50字）" />
        </div>

        <!-- Step 6: Confirm -->
        <div v-if="sheetStep === 6" class="confirm-summary">
          <p>操作：{{ newOp.type }}</p>
          <p>日期：{{ newOp.date }}</p>
          <p>作物：{{ getCropName(newOp.crop_id) }}</p>
          <p v-if="newOp.note">备注：{{ newOp.note }}</p>
        </div>

        <!-- Templates -->
        <div v-if="sheetStep === 4 && matchingTemplates.length > 0" class="template-section">
          <button class="btn btn-outline btn-sm" @click="showTemplates = !showTemplates">
            {{ showTemplates ? '收起模板' : '选择模板' }}
          </button>
          <div v-if="showTemplates" class="template-list">
            <div v-for="tpl in matchingTemplates" :key="tpl.id" class="template-item" @click="applyTemplate(tpl)">
              {{ tpl.name }}
            </div>
          </div>
        </div>

        <!-- Save as template -->
        <div v-if="sheetStep === 4" class="form-group">
          <button class="btn btn-outline btn-sm" @click="saveAsTemplate">保存为模板</button>
        </div>

        <!-- Navigation -->
        <div class="sheet-nav">
          <button v-if="sheetStep > 1" class="btn btn-outline" @click="sheetStep--">上一步</button>
          <div class="spacer"></div>
          <button v-if="sheetStep < 6" class="btn btn-primary" @click="nextSheetStep">下一步</button>
          <button v-if="sheetStep === 6" class="btn btn-accent" @click="confirmSave">确认保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const store = useAppStore();
const config = computed(() => store.config);
const operations = ref([]);
const templates = ref([]);
const showSheet = ref(false);
const sheetStep = ref(1);
const sheetError = ref('');
const showTemplates = ref(false);
const showQuickTemplate = ref(false);
const selectedTemplate = ref(null);
const templateCropId = ref('');
const viewMode = ref('list');
const activeFilter = ref('all');
const statsPeriod = ref('month');
const stats = ref({});

// Date range and search
const dateRange = reactive({ start: '', end: '' });
const searchKeyword = ref('');

// Pagination
const currentPage = ref(1);
const pageSize = 12;

const filterTypes = [
  { value: 'all', label: '全部' },
  { value: '施肥', label: '🌿 施肥' },
  { value: '打药', label: '💧 打药' },
  { value: '灌溉', label: '💧 灌溉' },
  { value: '整枝打杈', label: '✂️ 整枝' },
  { value: '通风', label: '🌬 通风' },
  { value: '授粉', label: '🌸 授粉' },
  { value: '采收', label: '🥬 采收' },
  { value: '环境记录', label: '🌡 环境' },
  { value: '其他', label: '📝 其他' }
];

const opTypes = computed(() => {
  const isRaining = store.weather?.merged?.precipitation > 0;
  const isHighWind = (store.weather?.merged?.wind_speed ?? 0) > 8;
  return [
    { name: '施肥', icon: '🌿' },
    { name: '打药', icon: '💧', disabled: isRaining || isHighWind, disabledReason: isRaining ? '雨天禁止打药' : (isHighWind ? '大风天禁止打药' : '') },
    { name: '灌溉', icon: '💧' },
    { name: '整枝打杈', icon: '✂️' },
    { name: '通风', icon: '🌬' },
    { name: '授粉', icon: '🌸' },
    { name: '采收', icon: '🥬' },
    { name: '环境记录', icon: '🌡' },
    { name: '其他', icon: '📝' }
  ];
});

const newOp = reactive({
  crop_id: '',
  date: new Date().toISOString().slice(0, 10),
  type: '',
  details: {},
  note: ''
});

const activeCrops = computed(() => (config.value.crops || []).filter(c => c.status === 'active'));

const pesticideOptions = ref([]);
const fertilizerOptions = ref([]);
const diseaseOptions = ref(['早疫病', '晚疫病', '灰霉病', '霜霉病', '白粉病', '病毒病', '蚜虫', '白粉虱', '枯萎病', '炭疽病', '脐腐病', '叶霉病', '根腐病']);

const otherDescOptions = ['补苗', '除草', '翻地', '消毒', '清棚', '定植准备', '其他'];


const matchingTemplates = computed(() => {
  if (!newOp.type) return [];
  return templates.value.filter(t => t.type === newOp.type);
});

const groupedOps = computed(() => {
  let filtered = operations.value;

  // Filter by type
  if (activeFilter.value !== 'all') {
    filtered = filtered.filter(o => o.type === activeFilter.value);
  }

  // Filter by date range
  if (dateRange.start) {
    filtered = filtered.filter(o => o.date >= dateRange.start);
  }
  if (dateRange.end) {
    filtered = filtered.filter(o => o.date <= dateRange.end);
  }

  // Filter by search keyword
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim();
    filtered = filtered.filter(o =>
      o.type?.toLowerCase().includes(keyword) ||
      o.crop_name?.toLowerCase().includes(keyword) ||
      o.greenhouse_name?.toLowerCase().includes(keyword) ||
      o.note?.toLowerCase().includes(keyword)
    );
  }

  const groups = {};
  for (const op of filtered) {
    if (!groups[op.date]) groups[op.date] = [];
    groups[op.date].push(op);
  }
  return groups;
});

const totalFilteredCount = computed(() => {
  return Object.values(groupedOps.value).reduce((sum, group) => sum + group.length, 0);
});

const totalPages = computed(() => {
  return Math.ceil(totalFilteredCount.value / pageSize);
});

const paginatedGroupedOps = computed(() => {
  const allItems = [];
  const sortedDates = Object.keys(groupedOps.value).sort().reverse();

  for (const date of sortedDates) {
    for (const op of groupedOps.value[date]) {
      allItems.push({ ...op, _date: date });
    }
  }

  const startIndex = (currentPage.value - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedItems = allItems.slice(startIndex, endIndex);

  const result = {};
  for (const item of paginatedItems) {
    if (!result[item._date]) result[item._date] = [];
    result[item._date].push(item);
  }
  return result;
});

function getOpIcon(type) {
  const icons = { '施肥': '🌿', '打药': '💧', '灌溉': '💧', '整枝打杈': '✂️', '通风': '🌬', '授粉': '🌸', '采收': '🥬', '环境记录': '🌡', '其他': '📝' };
  return icons[type] || '📝';
}

function formatDetails(op) {
  const d = op.details;
  if (!d || typeof d !== 'object') return [];
  const items = [];
  switch (op.type) {
    case '施肥':
      if (d.fertilizer_name) items.push({ label: '肥料', value: d.fertilizer_name });
      if (d.dosage) items.push({ label: '用量', value: `${d.dosage}${d.unit || ''}` });
      break;
    case '打药':
      if (d.pesticide_name) items.push({ label: '农药', value: d.pesticide_name });
      if (d.dosage) items.push({ label: '用量', value: `${d.dosage}${d.unit || ''}` });
      if (d.target) items.push({ label: '防治对象', value: d.target });
      if (d.safety_interval) items.push({ label: '安全间隔期', value: `${d.safety_interval}天` });
      break;
    case '灌溉':
      if (d.duration) items.push({ label: '时长', value: `${d.duration}分钟` });
      if (d.method) items.push({ label: '方式', value: d.method });
      break;
    case '整枝打杈':
      if (d.action) items.push({ label: '操作', value: d.action });
      break;
    case '通风':
      if (d.action) items.push({ label: '操作', value: d.action });
      if (d.vent_position) items.push({ label: '通风口', value: d.vent_position });
      break;
    case '授粉':
      if (d.method) items.push({ label: '方式', value: d.method });
      break;
    case '采收':
      if (d.fruit_count) items.push({ label: '果数', value: `${d.fruit_count}个` });
      if (d.weight) items.push({ label: '重量', value: `${d.weight}${d.weight_unit || '斤'}` });
      break;
    case '环境记录':
      if (d.temp != null) items.push({ label: '棚温', value: `${d.temp}°C` });
      if (d.humidity != null) items.push({ label: '棚湿', value: `${d.humidity}%` });
      break;
    case '其他':
      if (d.description) items.push({ label: '描述', value: d.description });
      break;
  }
  return items;
}

function clearDateRange() {
  dateRange.start = '';
  dateRange.end = '';
  currentPage.value = 1;
}

function onChipScroll(e) {
  const el = e.currentTarget;
  if (e.deltaY !== 0) {
    el.scrollLeft += e.deltaY;
  }
}

function getMonthName(dateStr) {
  if (!dateStr) return '';
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const month = parseInt(dateStr.split('-')[1]) - 1;
  return months[month];
}

function getDay(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('-')[2];
}

function getCropName(id) {
  const crop = activeCrops.value.find(c => c.id === id);
  return crop ? `${crop.type} ${crop.variety_name}` : '未知';
}

function stepDetail(key, delta, min, max) {
  const current = newOp.details[key] || 0;
  newOp.details[key] = Math.max(min, Math.min(max, +(current + delta).toFixed(1)));
}

function nextSheetStep() {
  sheetError.value = '';
  if (sheetStep.value === 1 && !newOp.crop_id) { sheetError.value = '请选择作物'; return; }
  if (sheetStep.value === 2 && !newOp.date) { sheetError.value = '请选择日期'; return; }
  if (sheetStep.value === 3 && !newOp.type) { sheetError.value = '请选择操作类型'; return; }
  if (sheetStep.value === 4) {
    if (newOp.type === '打药' && !newOp.details.pesticide_name) { sheetError.value = '请选择农药名称'; return; }
    if (newOp.type === '施肥' && !newOp.details.fertilizer_name) { sheetError.value = '请选择肥料名称'; return; }
    if (newOp.type === '采收' && (!newOp.details.weight || newOp.details.weight <= 0)) { sheetError.value = '请填写采收重量'; return; }
  }
  sheetStep.value++;
}

async function onPesticideSelect() {
  if (!newOp.details.pesticide_name) return;
  try {
    const res = await axios.get(`/api/knowledge/pesticides/${encodeURIComponent(newOp.details.pesticide_name)}`);
    if (res.data) {
      newOp.details.safety_interval = res.data.safety_interval_days;
      if (res.data.dilution) newOp.details.dilution = res.data.dilution;
      if (res.data.dosage) newOp.details.dosage = parseFloat(res.data.dosage) || 0;
    }
  } catch (e) {}
}

function applyTemplate(tpl) {
  Object.assign(newOp.details, tpl.values);
  showTemplates.value = false;
}

function selectQuickTemplate(tpl) {
  selectedTemplate.value = tpl;
  templateCropId.value = '';
  showQuickTemplate.value = false;
}

async function applyQuickTemplate() {
  if (!selectedTemplate.value || !templateCropId.value) return;
  
  const tpl = selectedTemplate.value;
  newOp.crop_id = templateCropId.value;
  newOp.type = tpl.type;
  newOp.details = { ...tpl.values };
  newOp.date = new Date().toISOString().slice(0, 10);
  newOp.note = '';
  
  selectedTemplate.value = null;
  templateCropId.value = '';
  sheetStep.value = 4;
  showSheet.value = true;
}

async function saveAsTemplate() {
  let name;
  if (window.__modal) {
    name = await window.__modal.showPrompt('输入模板名称', '保存模板');
  }
  if (!name) return;
  try {
    await axios.post('/api/templates', { name, type: newOp.type, values: { ...newOp.details } });
    loadTemplates();
    if (window.__modal) window.__modal.showToast('模板已保存', 'success');
  } catch (e) {
    if (window.__modal) window.__modal.showToast('保存失败', 'error');
  }
}

async function confirmSave() {
  try {
    await axios.post('/api/operations', {
      type: newOp.type,
      date: newOp.date,
      crop_id: newOp.crop_id,
      greenhouse_id: activeCrops.value.find(c => c.id === newOp.crop_id)?.greenhouse_id,
      details: { ...newOp.details },
      note: newOp.note
    });
    showSheet.value = false;
    sheetStep.value = 1;
    newOp.type = '';
    newOp.details = {};
    newOp.note = '';
    if (window.__modal) window.__modal.showToast('操作记录已保存', 'success');
    loadOperations();
  } catch (err) {
    sheetError.value = err.response?.data?.error || '保存失败';
    sheetStep.value = 1;
  }
}

function getBarWidth(count) {
  const maxCount = Math.max(...Object.values(stats.value).filter(v => typeof v === 'number'), 1);
  return (count / maxCount) * 100;
}

async function deleteOperation(op) {
  const ok1 = window.__modal ? await window.__modal.showConfirm(`确认删除这条${op.type}记录？`, '第一次确认') : false;
  if (!ok1) return;
  const ok2 = window.__modal ? await window.__modal.showConfirm('此操作不可恢复，再次确认删除？', '第二次确认') : false;
  if (!ok2) return;
  try {
    await axios.delete(`/api/operations/${op.id}`);
    if (window.__modal) window.__modal.showToast('已删除', 'success');
    loadOperations();
    loadStats();
  } catch (err) {
    if (window.__modal) window.__modal.showToast('删除失败: ' + (err.response?.data?.error || err.message), 'error');
  }
}

async function loadOperations() {
  try {
    const res = await axios.get('/api/operations');
    operations.value = res.data;
  } catch (e) {}
}

async function loadTemplates() {
  try {
    const res = await axios.get('/api/templates');
    templates.value = res.data;
  } catch (e) {}
}

async function loadStats() {
  try {
    const res = await axios.get(`/api/operations/stats?period=${statsPeriod.value}`);
    stats.value = res.data;
  } catch (e) {}
}

async function loadPesticides() {
  try {
    const res = await axios.get('/api/knowledge/pesticides');
    pesticideOptions.value = res.data.map(p => p.name);
  } catch (e) {}
}

async function loadFertilizers() {
  try {
    // Combine knowledge base and inventory fertilizers
    const inv = config.value.inventory?.fertilizers || [];
    const names = inv.map(f => f.name);
    // Add common fertilizers
    const common = ['复合肥', '尿素', '磷酸二氢钾', '硫酸钾', '有机肥', '腐殖酸', '微量元素肥', '钙肥', '镁肥', '硝酸钾', '过磷酸钙'];
    fertilizerOptions.value = [...new Set([...names, ...common])];
  } catch (e) {}
}

// Load disease list from knowledge
async function loadDiseases() {
  try {
    const res = await axios.get('/api/knowledge/diseases');
    const names = res.data.map(d => d.name);
    if (names.length > 0) diseaseOptions.value = [...new Set([...diseaseOptions.value, ...names])];
  } catch (e) {}
}

// Watch filters and reset page
watch([activeFilter, dateRange, searchKeyword], () => {
  currentPage.value = 1;
});

onMounted(async () => {
  await store.fetchConfig();
  store.fetchWeather();
  loadOperations();
  loadTemplates();
  loadStats();
  loadPesticides();
  loadFertilizers();
  loadDiseases();
});
</script>

<style scoped>
.page.record-page h2 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text);
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.date-range-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.date-input {
  padding: 5px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  width: auto;
}

.date-separator {
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-clear {
  padding: 2px 6px;
  border: none;
  background: var(--danger);
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.btn-clear:hover {
  opacity: 0.85;
}

.search-box {
  flex: 1;
  min-width: 180px;
  max-width: 360px;
}

.search-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.chip-scroll {
  overflow-x: auto;
  margin-bottom: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.chip-scroll::-webkit-scrollbar {
  display: none;
}

.chip-group {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 4px 6px;
  width: max-content;
}

.view-toggle {
  display: flex;
  gap: 0;
  margin-bottom: 14px;
  border: none;
  border-radius: 10px;
  background: var(--border);
  overflow: hidden;
  padding: 3px;
}

.view-toggle .chip {
  flex: 1;
  text-align: center;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}

.view-toggle .chip:hover:not(.active) {
  background: rgba(255, 255, 255, 0.5);
}

.view-toggle .chip.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.date-group {
  margin-bottom: 12px;
}

.date-header {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 8px;
  padding-left: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.date-header::before {
  content: '';
  width: 3px;
  height: 12px;
  background: var(--primary);
  border-radius: 2px;
}

.op-card {
  position: relative;
  padding: 10px 10px 10px 52px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.op-card:active {
  transform: scale(0.985);
}

.op-calendar {
  position: absolute;
  left: 10px;
  top: 10px;
  width: 36px;
  height: 44px;
  background: linear-gradient(135deg, var(--primary), #2d7d46);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 2px 8px rgba(45, 125, 70, 0.25);
}

.calendar-month {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.calendar-day {
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

.op-body {
  flex: 1;
  min-width: 0;
}

.op-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.op-icon { font-size: 18px; flex-shrink: 0; }

.op-type {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  flex-shrink: 0;
}

.op-crop {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.op-note {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 3px;
  font-style: italic;
  opacity: 0.8;
}

.op-delete {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  color: var(--text-secondary);
  opacity: 0.4;
}

.op-delete:hover {
  background: rgba(211, 47, 47, 0.1);
  opacity: 1;
  color: var(--danger);
}

.op-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  margin-top: 6px;
}

.op-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-secondary);
  background: #f5f7f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.op-tag strong {
  color: var(--text);
  font-weight: 600;
}

.op-warnings {
  margin-top: 4px;
}

.warning-item {
  font-size: 11px;
  color: var(--warning);
  padding: 1px 0;
}

.type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
}
.type-card.selected { border-color: var(--primary); background: rgba(45, 125, 70, 0.05); }
.type-card.disabled { opacity: 0.4; cursor: not-allowed; }
.type-icon { font-size: 24px; }
.type-name { font-size: 12px; margin-top: 4px; }

.info-box { padding: 8px 12px; background: #fff3e0; border-radius: var(--radius-sm); font-size: 13px; margin: 8px 0; }

.template-section { margin: 12px 0; }
.template-list { margin-top: 8px; }
.template-item { padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 4px; cursor: pointer; font-size: 13px; }
.template-item:active { background: rgba(45, 125, 70, 0.1); }

.confirm-summary {
  padding: 14px;
  background: linear-gradient(135deg, #f8faf5, #f0f4ec);
  border-radius: var(--radius-sm);
  font-size: 14px;
  border: 1px solid var(--border);
}
.confirm-summary p { margin-bottom: 6px; line-height: 1.5; }
.confirm-summary p:last-child { margin-bottom: 0; }

.sheet-nav { display: flex; gap: 12px; margin-top: 16px; }
.sheet-nav .spacer { flex: 1; }

.stats-header { display: flex; gap: 8px; margin-bottom: 16px; }
.stat-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 4px 0;
}
.stat-label { width: 64px; font-size: 12px; text-align: right; color: var(--text-secondary); }
.stat-bar-track {
  flex: 1;
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
}
.stat-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 5px;
  transition: width 0.4s ease;
}
.stat-count { width: 28px; font-size: 13px; font-weight: 700; color: var(--primary); }

.empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  font-size: 14px;
}

.empty::before {
  content: '📭';
  display: block;
  font-size: 40px;
  margin-bottom: 12px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding: 14px 0;
}

.page-btn {
  padding: 7px 14px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.page-btn:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.template-chip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: white;
  font-weight: 600;
}

.template-chip:hover {
  background: linear-gradient(135deg, #fb8c00, #ef6c00);
}

.template-chip.active {
  background: linear-gradient(135deg, #e65100, #bf360c);
  box-shadow: 0 2px 8px rgba(255, 152, 0, 0.4);
}

.quick-template-panel {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 12px;
  margin-top: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border);
}

.empty-template {
  text-align: center;
  padding: 16px;
  color: var(--text-secondary);
  font-size: 13px;
}

.quick-template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.quick-template-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.quick-template-item:hover {
  background: var(--primary-light);
  transform: translateX(4px);
}

.template-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.template-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.template-type {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--bg-card);
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.template-crop-select {
  background: var(--bg-card);
  border-radius: 12px;
  padding: 16px;
  margin-top: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--primary);
}

.template-crop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.btn-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.btn-close:hover {
  color: var(--text);
}
</style>
