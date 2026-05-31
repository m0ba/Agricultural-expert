<template>
  <div class="page data-page">
    <!-- ===== VIEW: Experiment List ===== -->
    <template v-if="view === 'list'">
      <div class="page-header">
        <h2>数据记录</h2>
        <button class="btn btn-primary btn-sm" @click="openCreate">+ 新建试验</button>
      </div>

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
          <input type="text" v-model="searchKeyword" class="search-input" placeholder="搜索试验名称、作物、棚区..." />
        </div>
      </div>

      <div v-if="filteredExperiments.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>{{ experiments.length === 0 ? '暂无试验项目' : '未找到匹配的试验' }}</p>
        <button v-if="experiments.length === 0" class="btn btn-primary" @click="openCreate">创建第一个试验</button>
      </div>

      <div v-for="exp in paginatedExperiments" :key="exp.id" class="card exp-card">
        <!-- Single row: Calendar + Info + Buttons -->
        <div class="exp-header-row">
          <!-- Calendar date badge (month + day) -->
          <div class="exp-calendar-sm">
            {{ getMonthDay(exp.created_at) }}
          </div>

          <!-- Experiment info (center) -->
          <div class="exp-info-center">
            <div class="exp-name">{{ exp.name }}</div>
            <div class="exp-meta-inline">
              <span v-if="exp.greenhouse">棚：{{ exp.greenhouse }}</span>
              <span v-if="exp.crop">作物：{{ exp.crop }}</span>
              <span>指标：{{ exp.metrics?.length || 0 }}</span>
              <span>处理：{{ exp.treatments?.length || 0 }}</span>
              <span v-if="exp.lastDate">最近：{{ exp.lastDate }}</span>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="exp-actions-inline">
            <button class="btn btn-primary btn-sm" @click="continueRecording(exp)">录入</button>
            <button class="btn btn-outline btn-sm" @click="viewHistory(exp)">查看</button>
            <button class="btn btn-outline btn-sm" @click="openExport(exp)">导出</button>
            <button class="btn btn-outline btn-sm danger-text" @click="deleteExperiment(exp)">删除</button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页（共 {{ filteredExperiments.length }} 条）</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
      </div>
    </template>

    <!-- ===== VIEW: Create Experiment (Multi-Step) ===== -->
    <template v-if="view === 'create'">
      <div class="page-header">
        <button class="btn-back" @click="view = 'list'">← 返回</button>
        <h2>新建试验 ({{ createStep }}/4)</h2>
      </div>

      <div class="create-progress">
        <span v-for="i in 4" :key="i" class="progress-dot" :class="{ active: i === createStep, done: i < createStep }">{{ i }}</span>
      </div>

      <!-- Step 1: Name -->
      <div v-if="createStep === 1" class="card">
        <div class="form-group">
          <label class="form-label">试验名称</label>
          <input v-model="createForm.name" @input="removeSpaces('createForm.name', createForm.name); checkExpName()" class="form-input" maxlength="100" placeholder="如：黄瓜株高茎粗叶片数果重测定" />
          <div v-if="expNameError" class="name-error">{{ expNameError }}</div>
        </div>
        <button class="btn btn-primary full-width" @click="nextCreateStep" :disabled="!createForm.name.trim() || !!expNameError">下一步</button>
      </div>

      <!-- Step 2: Greenhouse + Crop -->
      <div v-if="createStep === 2" class="card">
        <div class="form-group">
          <label class="form-label">关联棚区</label>
          <select v-model="createForm.greenhouse" class="form-select">
            <option value="">不关联</option>
            <option v-for="gh in greenhouses" :key="gh.id" :value="gh.name">{{ gh.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">关联作物</label>
          <select v-model="createForm.crop" class="form-select">
            <option value="">不关联</option>
            <option v-for="c in filteredCrops" :key="c.id" :value="c.type + (c.variety_name ? ' ' + c.variety_name : '')">
              {{ c.type }}{{ c.variety_name ? ' ' + c.variety_name : '' }} ({{ c.greenhouse_name }})
            </option>
          </select>
        </div>
        <div class="sheet-nav">
          <button class="btn btn-outline" @click="createStep--">上一步</button>
          <button class="btn btn-primary" @click="nextCreateStep">下一步</button>
        </div>
      </div>

      <!-- Step 3: Metrics -->
      <div v-if="createStep === 3" class="card">
        <div class="form-group">
          <label class="form-label">选择指标（可多选+自定义）</label>
          <select class="form-select" @change="addMetricFromDropdown($event)">
            <option value="">从下拉框添加常用指标...</option>
            <option v-for="m in commonMetrics" :key="m.name" :value="m.name" :disabled="createForm.metrics.some(x => x.name === m.name)">
              {{ m.name }}{{ m.unit ? `(${m.unit})` : '' }}
            </option>
          </select>
        </div>

        <div class="selected-list">
          <div v-for="(m, idx) in createForm.metrics" :key="idx" class="selected-item">
            <span>{{ m.name }}{{ m.unit ? `(${m.unit})` : '' }}</span>
            <button class="btn-remove" @click="createForm.metrics.splice(idx, 1)">✕</button>
          </div>
          <div v-if="createForm.metrics.length === 0" class="empty-hint">请选择或添加指标</div>
        </div>

        <div class="custom-add">
          <input v-model="customMetricName" @input="removeSpaces('customMetricName', customMetricName)" class="form-input-sm" placeholder="自定义指标名称" maxlength="30" />
          <input v-model="customMetricUnit" @input="removeSpaces('customMetricUnit', customMetricUnit)" class="form-input-sm" placeholder="单位" maxlength="10" />
          <button class="btn btn-outline btn-sm" @click="addCustomMetricToCreate" :disabled="!customMetricName.trim()">添加</button>
        </div>

        <div class="sheet-nav">
          <button class="btn btn-outline" @click="createStep--">上一步</button>
          <button class="btn btn-primary" @click="nextCreateStep" :disabled="createForm.metrics.length === 0">下一步</button>
        </div>
      </div>

      <!-- Step 4: Treatments -->
      <div v-if="createStep === 4" class="card">
        <div class="form-group">
          <label class="form-label">添加处理（如 CK、T1、T2...）</label>
          <div class="custom-add">
            <input v-model="customTreatmentName" @input="removeSpaces('customTreatmentName', customTreatmentName)" class="form-input-sm" placeholder="处理名称" maxlength="30" @keydown.enter.prevent="addTreatmentToCreate" />
            <button class="btn btn-outline btn-sm" @click="addTreatmentToCreate" :disabled="!customTreatmentName.trim()">添加</button>
          </div>
        </div>

        <div class="selected-list">
          <div v-for="(t, idx) in createForm.treatments" :key="idx" class="selected-item">
            <span>{{ t.name }}</span>
            <button class="btn-remove" @click="createForm.treatments.splice(idx, 1)">✕</button>
          </div>
          <div v-if="createForm.treatments.length === 0" class="empty-hint">请添加处理</div>
        </div>

        <div class="sheet-nav">
          <button class="btn btn-outline" @click="createStep--">上一步</button>
          <button class="btn btn-primary" @click="submitCreate" :disabled="createForm.treatments.length === 0">创建试验</button>
        </div>
      </div>
    </template>

    <!-- ===== VIEW: Setup Recording ===== -->
    <template v-if="view === 'setup'">
      <div class="page-header">
        <button class="btn-back" @click="view = 'list'">← 返回</button>
        <h2>{{ currentExp.name }}</h2>
      </div>

      <div class="card compact-card">
        <div class="form-group">
          <label class="form-label">测量日期</label>
          <input type="date" v-model="setupDate" class="form-input" />
          <div class="date-info">
            ℹ️ 每次录入将自动创建独立文件（时分秒区分）
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">选择本次录入的指标</label>
          <div class="checkbox-group">
            <label v-for="m in currentExp.metrics" :key="m.id" class="checkbox-option" :class="{ selected: setupMetrics.includes(m.id) }">
              <input type="checkbox" :value="m.id" v-model="setupMetrics" />
              {{ m.name }}{{ m.unit ? `(${m.unit})` : '' }}
            </label>
          </div>
          <button class="btn btn-outline btn-sm" @click="showAddMetric = !showAddMetric">+ 新增指标</button>
          <div v-if="showAddMetric" class="add-form">
            <select class="form-select" @change="addMetricFromDropdownSetup($event)">
              <option value="">从下拉框添加...</option>
              <option v-for="m in commonMetrics" :key="m.name" :value="m.name" :disabled="currentExp.metrics.some(x => x.name === m.name)">
                {{ m.name }}{{ m.unit ? `(${m.unit})` : '' }}
              </option>
            </select>
            <div class="custom-add" style="margin-top:6px">
              <input v-model="newMetricName" @input="removeSpaces('newMetricName', newMetricName)" class="form-input-sm" placeholder="自定义名称" maxlength="30" />
              <input v-model="newMetricUnit" @input="removeSpaces('newMetricUnit', newMetricUnit)" class="form-input-sm" placeholder="单位" maxlength="10" />
              <button class="btn btn-primary btn-sm" @click="addMetric" :disabled="!newMetricName.trim()">添加</button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">选择本次录入的处理</label>
          <div class="checkbox-group">
            <label v-for="t in currentExp.treatments" :key="t.id" class="checkbox-option" :class="{ selected: setupTreatments.includes(t.id) }">
              <input type="checkbox" :value="t.id" v-model="setupTreatments" />
              {{ t.name }}
            </label>
          </div>
          <button class="btn btn-outline btn-sm" @click="showAddTreatment = !showAddTreatment">+ 新增处理</button>
          <div v-if="showAddTreatment" class="add-form">
            <div class="custom-add">
              <input v-model="newTreatmentName" @input="removeSpaces('newTreatmentName', newTreatmentName)" class="form-input-sm" placeholder="处理名称" maxlength="30" />
              <button class="btn btn-primary btn-sm" @click="addTreatment" :disabled="!newTreatmentName.trim()">添加</button>
            </div>
          </div>
        </div>

        <button class="btn btn-primary full-width" @click="startEntry" :disabled="setupMetrics.length === 0 || setupTreatments.length === 0 || !setupDate">
          开始录入
        </button>
      </div>
    </template>

    <!-- ===== VIEW: Data Entry ===== -->
    <template v-if="view === 'entry'">
      <div class="page-header compact-header">
        <button class="btn-back" @click="confirmExitEntry">← 返回</button>
        <h2>{{ setupDate }}</h2>
        <button class="btn btn-primary btn-sm" @click="finishEntry">完成录入</button>
      </div>

      <div class="entry-hint">
        ⚠️ 数字=实际值 | 00=空值(死亡/未测) | 0=实际0值 | 多个0均为空值
      </div>

      <div class="entry-progress">
        <span v-for="tName in entryTreatmentOrder" :key="tName" class="progress-tag" :class="getProgressClass(tName)">
          {{ tName }}
        </span>
      </div>

      <div v-for="tName in entryTreatmentOrder" :key="tName" class="card treatment-card compact-card">
        <!-- Collapsed: [处理名] [指标方格...] -->
        <div v-if="treatmentState[tName].collapsed" class="treatment-collapsed" @click="expandTreatment(tName)">
          <span class="treatment-name-sm">{{ tName }}</span>
          <span v-for="mId in treatmentState[tName].savedMetricOrder" :key="mId" class="metric-square" @click.stop="expandTreatment(tName)">
            {{ getMetricFirstChar(mId) }}
          </span>
        </div>

        <!-- Expanded -->
        <template v-else>
          <!-- Header: [处理名] [已保存方格...] [□] [保存] -->
          <div class="treatment-header-row">
            <span class="treatment-name-sm">{{ tName }}</span>
            <span v-for="mId in treatmentState[tName].savedMetricOrder" :key="mId" class="metric-square metric-saved" @click.stop="editSavedMetric(tName, mId)" title="点击编辑">
              {{ getMetricFirstChar(mId) }}
            </span>
            <span class="empty-square"></span>
            <button class="btn-save" @click="saveAndCollapseTreatment(tName)" :disabled="!canSaveTreatment(tName)">暂存</button>
          </div>

          <!-- Unsaved metrics -->
          <div v-for="m in getUnsavedMetrics(tName)" :key="m.id" class="metric-row">
            <span class="metric-label">{{ m.name }}{{ m.unit ? `(${m.unit})` : '' }}</span>
            <span v-for="(val, idx) in treatmentState[tName].metrics[m.id].values" :key="idx" class="value-chip" :class="{ 'value-null': isNullValue(val) }" @click="editValue(tName, m.id, idx)">
              {{ idx + 1 }}:{{ formatDisplayValue(val) }}
            </span>
            <div class="val-input-group">
              <input
                :ref="el => setValInputRef(tName, m.id, el)"
                v-model="treatmentState[tName].metrics[m.id].currentValue"
                class="val-input"
                :class="{ 'input-error': treatmentState[tName].metrics[m.id].showError }"
                @input="treatmentState[tName].metrics[m.id].currentValue = treatmentState[tName].metrics[m.id].currentValue.replace(/\s/g, '')"
                @keydown.enter.prevent="addValue(tName, m.id)"
                @keydown.tab.prevent="addValueAndNext(tName, m.id)"
                inputmode="decimal"
                :placeholder="(treatmentState[tName].metrics[m.id].values.length + 1) + ''"
              />
              <button class="btn-mini" @click="addValue(tName, m.id)">✓</button>
              <button v-if="treatmentState[tName].metrics[m.id].values.length > 0" class="btn-mini btn-mini-outline" @click="modifyLast(tName, m.id)">↩</button>
              <button v-if="treatmentState[tName].metrics[m.id].values.length > 0" class="btn-mini btn-mini-save" @click="saveMetric(tName, m.id)">存</button>
            </div>
            <div v-if="treatmentState[tName].metrics[m.id].showError" class="input-error-msg">⚠️ 不允许负数或非法字符</div>
          </div>

          <div class="note-row">
            <input v-model="treatmentState[tName].note" @input="treatmentState[tName].note = treatmentState[tName].note.replace(/\s/g, ''); saveCache()" class="note-input" maxlength="50" placeholder="备注（可选）" />
            <span class="char-count">{{ (treatmentState[tName].note || '').length }}/50</span>
          </div>
        </template>
      </div>
    </template>

    <!-- ===== VIEW: History ===== -->
    <template v-if="view === 'history'">
      <div class="page-header">
        <button class="btn-back" @click="view = 'list'">← 返回</button>
        <h2>{{ currentExp.name }} - 历史</h2>
      </div>

      <div v-if="historyDates.length === 0" class="empty-state"><p>暂无历史数据</p></div>

      <div v-for="date in historyDates" :key="date" class="card history-card compact-card">
        <div class="history-header">
          <span class="history-date">{{ formatDisplayDate(date) }}</span>
          <div class="history-actions">
            <button class="btn btn-outline btn-sm" @click="viewDateData(date)">查看</button>
            <button class="btn btn-outline btn-sm" @click="exportSingleDate(date)">导出</button>
            <button class="btn btn-outline btn-sm danger-text" @click="deleteDateRecords(date)">删除</button>
          </div>
        </div>
      </div>

      <div v-if="showDateDetail" class="bottom-sheet-overlay" @click="showDateDetail = false">
        <div class="bottom-sheet bottom-sheet-wide" @click.stop>
          <div class="bottom-sheet-handle"></div>
          <h3>{{ detailDate }} 数据详情</h3>

          <!-- Table View -->
          <div v-if="detailRecords.length > 0" class="table-container">
            <div class="data-preview-grid" :style="{ '--grid-cols': maxGlobalRepeats }">
              <!-- Loop through each treatment group -->
              <template v-for="(treatment, tIndex) in groupedByTreatment" :key="'t-'+tIndex">
                <!-- Treatment header row -->
                <div class="grid-row grid-header">
                  <div class="grid-cell cell-treatment-name">
                    <span class="treatment-icon">📌</span>
                    {{ treatment.name }}
                  </div>
                  <div v-for="n in maxGlobalRepeats" :key="'seq-'+tIndex+'-'+n"
                       :class="['grid-cell', 'cell-sequence', { 'cell-empty-seq': n > treatment.maxRepeats }]">
                    {{ n <= treatment.maxRepeats ? n : '' }}
                  </div>
                </div>

                <!-- Data rows for each metric -->
                <div v-for="(metric, mIndex) in detailColumns" :key="'m-'+tIndex+'-'+mIndex" class="grid-row grid-data">
                  <div class="grid-cell cell-metric-label">{{ metric }}</div>
                  <div v-for="n in maxGlobalRepeats" :key="'v-'+tIndex+'-'+mIndex+'-'+n"
                       :class="['grid-cell', 'cell-value', { 'cell-null': !getMetricValue(treatment.record, metric, n) }]"
                       v-html="formatCellValue(getMetricValue(treatment.record, metric, n))">
                  </div>
                </div>

                <!-- Note row if exists -->
                <div v-if="treatment.record.note" :key="'note-'+tIndex" class="grid-row grid-note">
                  <div class="grid-cell cell-metric-label">备注</div>
                  <div :class="['grid-cell', 'cell-note']" :style="{ gridColumn: 'span ' + maxGlobalRepeats }">
                    {{ treatment.record.note }}
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div v-else class="empty">无数据</div>

          <button class="btn btn-outline full-width" @click="showDateDetail = false">关闭</button>
        </div>
      </div>
    </template>

    <!-- ===== VIEW: Export ===== -->
    <template v-if="view === 'export'">
      <div class="page-header">
        <button class="btn-back" @click="view = 'list'">← 返回</button>
        <h2>导出 - {{ currentExp.name }}</h2>
      </div>

      <div class="card">
        <div class="form-group">
          <label class="form-label">选择导出日期</label>
          <div class="checkbox-group">
            <label v-for="date in exportDates" :key="date" class="checkbox-option" :class="{ selected: selectedExportDates.includes(date) }">
              <input type="checkbox" :value="date" v-model="selectedExportDates" />
              {{ date }}
            </label>
          </div>
          <div class="export-select-actions">
            <button class="btn btn-outline btn-sm" @click="selectedExportDates = [...exportDates]">全选</button>
            <button class="btn btn-outline btn-sm" @click="selectedExportDates = []">取消全选</button>
          </div>
        </div>
        <div class="export-info">
          <p>• 1个日期 → CSV文件</p>
          <p>• 多个日期 → ZIP压缩包（每个日期独立CSV，不合并）</p>
        </div>
        <button class="btn btn-primary full-width" @click="doExport" :disabled="selectedExportDates.length === 0">
          导出{{ selectedExportDates.length > 1 ? ` (ZIP, ${selectedExportDates.length}个文件)` : '' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const store = useAppStore();
const config = computed(() => store.config);
const greenhouses = computed(() => config.value.greenhouses || []);
const allCrops = computed(() => (config.value.crops || []).filter(c => c.status === 'active'));
const filteredCrops = computed(() => {
  if (!createForm.greenhouse) return allCrops.value;
  const gh = greenhouses.value.find(g => g.name === createForm.greenhouse);
  if (!gh) return allCrops.value;
  return allCrops.value.filter(c => c.greenhouse_id === gh.id || c.greenhouse_name === gh.name);
});

const commonMetrics = [
  { name: '株高', unit: 'cm' },
  { name: '茎粗', unit: 'mm' },
  { name: '叶片数', unit: '片' },
  { name: '花朵数', unit: '个' },
  { name: '坐果数', unit: '个' },
  { name: '单果重', unit: 'g' },
  { name: '果长', unit: 'cm' },
  { name: '果径', unit: 'cm' },
  { name: '采收果数', unit: '个' },
  { name: '采收总重', unit: 'kg' },
  { name: '叶长', unit: 'cm' },
  { name: '叶宽', unit: 'cm' },
  { name: '节间距', unit: 'cm' },
  { name: '棚温', unit: '°C' },
  { name: '棚湿', unit: '%' },
  { name: '叶色', unit: '' },
  { name: '长势', unit: '' },
  { name: '病害程度', unit: '' }
];

const experiments = ref([]);
const view = ref('list');
const currentExp = ref(null);

// Date range and search
const dateRange = reactive({ start: '', end: '' });
const searchKeyword = ref('');

// Pagination
const currentPage = ref(1);
const pageSize = 10;

const createStep = ref(1);
const createForm = reactive({
  name: '',
  greenhouse: '',
  crop: '',
  metrics: [],
  treatments: []
});
const customMetricName = ref('');
const customMetricUnit = ref('');
const customTreatmentName = ref('');

const setupDate = ref(new Date().toISOString().slice(0, 10));
const setupMetrics = ref([]);
const setupTreatments = ref([]);
const showAddMetric = ref(false);
const newMetricName = ref('');
const newMetricUnit = ref('');
const showAddTreatment = ref(false);
const newTreatmentName = ref('');

const dateConflict = ref(false);
const setupDateSeq = ref('');
const dateSeqLocked = ref(false);
const existingDates = ref([]);
const expNameError = ref('');

const entryTreatmentOrder = ref([]);
const selectedMetrics = ref([]);
const treatmentState = reactive({});

const historyDates = ref([]);
const showDateDetail = ref(false);
const detailDate = ref('');
const detailRecords = ref([]);
const detailColumns = ref([]);

const exportDates = ref([]);
const selectedExportDates = ref([]);

const valInputRefs = {};
function setValInputRef(tName, mId, el) {
  if (el) valInputRefs[`${tName}_${mId}`] = el;
}

function isNullValue(val) {
  if (!val) return false;
  if (typeof val === 'string' && val.length >= 2 && /^0+$/.test(val)) return true;
  return false;
}

function formatDisplayValue(val) {
  if (isNullValue(val)) return 'Ø';
  return val;
}

async function loadExperiments() {
  try {
    const res = await axios.get('/api/experiments');
    experiments.value = res.data;
  } catch (e) {}
}

const filteredExperiments = computed(() => {
  let filtered = experiments.value;

  // Filter by date range
  if (dateRange.start) {
    filtered = filtered.filter(exp => exp.lastDate >= dateRange.start);
  }
  if (dateRange.end) {
    filtered = filtered.filter(exp => exp.lastDate <= dateRange.end);
  }

  // Filter by search keyword
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim();
    filtered = filtered.filter(exp =>
      exp.name?.toLowerCase().includes(keyword) ||
      exp.crop?.toLowerCase().includes(keyword) ||
      exp.greenhouse?.toLowerCase().includes(keyword)
    );
  }

  return filtered;
});

const totalPages = computed(() => {
  return Math.ceil(filteredExperiments.value.length / pageSize);
});

const paginatedExperiments = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return filteredExperiments.value.slice(startIndex, endIndex);
});

function clearDateRange() {
  dateRange.start = '';
  dateRange.end = '';
  currentPage.value = 1;
}

function getMonthName(dateStr) {
  if (!dateStr) return '无';
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const month = parseInt(dateStr.split('-')[1]) - 1;
  return months[month];
}

function getDay(dateStr) {
  if (!dateStr) return '--';
  return dateStr.split('-')[2];
}

function getMonthDay(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '--';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return month + day;
}

// Watch filters and reset page
watch([dateRange, searchKeyword], () => {
  currentPage.value = 1;
});

// Global space removal function for all inputs
function removeSpaces(field, value) {
  if (typeof value === 'string') {
    const noSpace = value.replace(/\s/g, '');
    if (field.startsWith('createForm.')) {
      const key = field.replace('createForm.', '');
      createForm[key] = noSpace;
    } else if (field === 'customMetricName') customMetricName.value = noSpace;
    else if (field === 'customMetricUnit') customMetricUnit.value = noSpace;
    else if (field === 'customTreatmentName') customTreatmentName.value = noSpace;
    else if (field === 'newMetricName') newMetricName.value = noSpace;
    else if (field === 'newMetricUnit') newMetricUnit.value = noSpace;
    else if (field === 'newTreatmentName') newTreatmentName.value = noSpace;
  }
}

function openCreate() {
  createStep.value = 1;
  createForm.name = '';
  createForm.greenhouse = '';
  createForm.crop = '';
  createForm.metrics = [];
  createForm.treatments = [];
  customMetricName.value = '';
  customMetricUnit.value = '';
  customTreatmentName.value = '';
  view.value = 'create';
}

function nextCreateStep() {
  if (createStep.value === 1) {
    const name = createForm.name.trim();
    if (!name) return;
    if (/\s/.test(createForm.name)) {
      expNameError.value = '名称不能包含空格';
      return;
    }
  }
  if (createStep.value === 3 && createForm.metrics.length === 0) return;
  createStep.value++;
}

function addMetricFromDropdown(e) {
  const name = e.target.value;
  e.target.value = '';
  if (!name) return;
  const found = commonMetrics.find(m => m.name === name);
  if (found && !createForm.metrics.some(x => x.name === found.name)) {
    createForm.metrics.push({ name: found.name, unit: found.unit });
  }
}

function addCustomMetricToCreate() {
  const name = customMetricName.value.trim();
  if (!name) return;
  if (createForm.metrics.some(x => x.name === name)) return;
  createForm.metrics.push({ name, unit: customMetricUnit.value.trim() });
  customMetricName.value = '';
  customMetricUnit.value = '';
}

function addTreatmentToCreate() {
  const name = customTreatmentName.value.trim();
  if (!name) return;
  if (createForm.treatments.some(x => x.name === name)) return;
  createForm.treatments.push({ name });
  customTreatmentName.value = '';
}

async function submitCreate() {
  const name = createForm.name.trim();
  if (!name || /\s/.test(createForm.name)) {
    expNameError.value = '名称不能包含空格';
    createStep.value = 1;
    return;
  }
  try {
    const res = await axios.post('/api/experiments', { name: createForm.name.trim() });
    const expId = res.data.id;

    for (const m of createForm.metrics) {
      await axios.post(`/api/experiments/${expId}/metrics`, { name: m.name, unit: m.unit });
    }
    for (const t of createForm.treatments) {
      await axios.post(`/api/experiments/${expId}/treatments`, { name: t.name });
    }

    await axios.put(`/api/experiments/${expId}`, {
      greenhouse: createForm.greenhouse,
      crop: createForm.crop
    });

    await loadExperiments();

    const newExp = experiments.value.find(e => e.id === expId);
    if (newExp) {
      currentExp.value = newExp;
      setupDate.value = new Date().toISOString().slice(0, 10);
      setupMetrics.value = (newExp.metrics || []).map(m => m.id);
      setupTreatments.value = (newExp.treatments || []).map(t => t.id);
      showAddMetric.value = false;
      showAddTreatment.value = false;
      view.value = 'setup';
    } else {
      view.value = 'list';
    }

    if (window.__modal) window.__modal.showToast('试验创建成功，请开始录入', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '创建失败', 'error');
  }
}

async function continueRecording(exp) {
  if (window.__modal) {
    const ok = await window.__modal.showConfirm(`进入"${exp.name}"的录入？`, '继续录入');
    if (!ok) return;
  }

  currentExp.value = exp;
  setupDate.value = new Date().toISOString().slice(0, 10);
  setupMetrics.value = (exp.metrics || []).map(m => m.id);
  setupTreatments.value = (exp.treatments || []).map(t => t.id);
  showAddMetric.value = false;
  showAddTreatment.value = false;

  console.log(`[DEBUG] continueRecording - expId:${exp.id}, 显示日期:${setupDate.value} (文件名将自动添加时分秒)`);

  view.value = 'setup';
}

function checkDateConflict() {
  if (!currentExp.value?.dates) return;
  const dateStr = setupDate.value;
  const allSame = (currentExp.value.dates || []).filter(d => d === dateStr || d.startsWith(dateStr + '-'));
  if (allSame.length > 0) {
    dateConflict.value = true;
    setupDateSeq.value = `${dateStr}-${allSame.length + 1}`;
  } else {
    dateConflict.value = false;
    setupDateSeq.value = '';
  }
}

function checkExpName() {
  const name = createForm.name;
  if (!name) { expNameError.value = ''; return; }
  if (/\s/.test(name)) {
    expNameError.value = '名称不能包含空格';
    return;
  }
  const trimmed = name.trim();
  const dup = experiments.value.find(e => e.name === trimmed);
  if (dup) {
    expNameError.value = '名称已存在，请使用其他名称';
  } else {
    expNameError.value = '';
  }
}

function addMetricFromDropdownSetup(e) {
  const name = e.target.value;
  e.target.value = '';
  if (!name) return;
  const found = commonMetrics.find(m => m.name === name);
  if (found) {
    newMetricName.value = found.name;
    newMetricUnit.value = found.unit;
    addMetric();
  }
}

async function addMetric() {
  if (!newMetricName.value.trim()) return;
  try {
    const res = await axios.post(`/api/experiments/${currentExp.value.id}/metrics`, {
      name: newMetricName.value.trim(),
      unit: newMetricUnit.value.trim()
    });
    currentExp.value.metrics.push(res.data);
    setupMetrics.value.push(res.data.id);
    newMetricName.value = '';
    newMetricUnit.value = '';
    showAddMetric.value = false;
    if (window.__modal) window.__modal.showToast('指标已添加', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '添加失败', 'error');
  }
}

async function addTreatment() {
  if (!newTreatmentName.value.trim()) return;
  try {
    const res = await axios.post(`/api/experiments/${currentExp.value.id}/treatments`, {
      name: newTreatmentName.value.trim()
    });
    currentExp.value.treatments.push(res.data);
    setupTreatments.value.push(res.data.id);
    newTreatmentName.value = '';
    showAddTreatment.value = false;
    if (window.__modal) window.__modal.showToast('处理已添加', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '添加失败', 'error');
  }
}

function getCacheKey() {
  const lockedDate = window.__sessionLockedDate || setupDateSeq.value || setupDate.value;
  return `entry_cache_${currentExp.value?.id}_${lockedDate}`;
}

function saveCache() {
  const key = getCacheKey();
  const data = {};
  for (const tName of entryTreatmentOrder.value) {
    const s = treatmentState[tName];
    if (!s) continue;
    const metrics = {};
    for (const m of selectedMetrics.value) {
      const ms = s.metrics[m.id];
      if (ms && (ms.values.length > 0 || ms.currentValue)) {
        metrics[m.id] = { values: [...ms.values], currentValue: ms.currentValue };
      }
    }
    data[tName] = { note: s.note, savedMetricOrder: [...s.savedMetricOrder], collapsed: s.collapsed, recordId: s.recordId, metrics };
  }
  localStorage.setItem(key, JSON.stringify(data));
}

function loadCache() {
  const key = getCacheKey();
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return false;
  }
}

function clearCache() {
  const key = getCacheKey();
  console.log(`[DEBUG] clearCache - 删除缓存key: ${key}`);
  localStorage.removeItem(key);
}

function startEntry() {
  try {
    console.log('[startEntry] 开始执行');

    if (!currentExp.value) {
      console.error('[startEntry] 错误: currentExp为空');
      if (window.__modal) window.__modal.showToast('系统错误：试验数据未加载', 'error');
      return;
    }

    if (!currentExp.value.metrics || !currentExp.value.treatments) {
      console.error('[startEntry] 错误: 试验数据不完整', currentExp.value);
      if (window.__modal) window.__modal.showToast('系统错误：试验数据不完整', 'error');
      return;
    }

    console.log('[startEntry] 过滤指标...');
    selectedMetrics.value = currentExp.value.metrics.filter(m => setupMetrics.value.includes(m.id));
    
    console.log('[startEntry] 过滤处理...');
    const treatments = currentExp.value.treatments.filter(t => setupTreatments.value.includes(t.id));
    entryTreatmentOrder.value = treatments.map(t => t.name);

    console.log('[startEntry] 选择结果:', selectedMetrics.value.length, '个指标,', entryTreatmentOrder.value.length, '个处理');

    const now = new Date();
    const dateStr = setupDate.value || now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const timestampedDate = dateStr + '-' + timeStr;

    console.log('[startEntry] 日期设置:', timestampedDate);

    window.__sessionLockedDate = timestampedDate;

    const sessionKey = 'session_' + (currentExp.value.id || '');
    localStorage.setItem(sessionKey, timestampedDate);

    console.log('[startEntry] 清理旧状态...');
    const keysToRemove = Object.keys(treatmentState);
    keysToRemove.forEach(k => delete treatmentState[k]);

    console.log('[startEntry] 初始化新状态...');
    for (let i = 0; i < entryTreatmentOrder.value.length; i++) {
      const tName = entryTreatmentOrder.value[i];
      const metricsState = {};

      for (let j = 0; j < selectedMetrics.value.length; j++) {
        const m = selectedMetrics.value[j];
        metricsState[m.id] = { values: [], currentValue: '' };
      }

      treatmentState[tName] = {
        collapsed: false,
        note: '',
        recordId: null,
        savedMetricOrder: [],
        metrics: metricsState
      };
    }

    console.log('[startEntry] 切换到entry视图...');
    dateSeqLocked.value = true;
    view.value = 'entry';

    console.log('[startEntry] ✓ 完成');

    if (window.__modal) window.__modal.showToast('进入录入模式', 'success');

  } catch (err) {
    console.error('[startEntry] 异常:', err);
    if (window.__modal) window.__modal.showToast('启动失败: ' + err.message, 'error');
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})(?:-(\d{6}))?$/);
  if (match) {
    const datePart = match[1];
    const timePart = match[2];
    if (timePart) {
      const h = timePart.slice(0, 2);
      const m = timePart.slice(2, 4);
      const s = timePart.slice(4, 6);
      return `${datePart} ${h}:${m}:${s}`;
    }
    return datePart;
  }
  return dateStr;
}

function getMetricFirstChar(mId) {
  const m = selectedMetrics.value.find(x => x.id === mId);
  return m ? m.name.charAt(0) : '?';
}

function getUnsavedMetrics(tName) {
  const saved = treatmentState[tName].savedMetricOrder || [];
  return selectedMetrics.value.filter(m => !saved.includes(m.id));
}

function saveMetric(tName, mId) {
  const state = treatmentState[tName];
  const vals = state.metrics[mId].values;

  if (vals.length === 0) {
    if (window.__modal) window.__modal.showToast('请先输入数据', 'warning');
    return;
  }

  if (!state.savedMetricOrder.includes(mId)) {
    state.savedMetricOrder.push(mId);
  }

  saveCache();

  console.log(`[DEBUG] saveMetric (local only) - tName:${tName}, mId:${mId}, values:${JSON.stringify(vals)}`);

  if (window.__modal) window.__modal.showToast(`${tName} ${getMetricFirstChar(mId)} 已暂存`, 'success');

  const unsavedCount = getUnsavedMetrics(tName).length;
  if (unsavedCount === 0 && state.savedMetricOrder.length === selectedMetrics.value.length) {
    state.collapsed = true;
    saveCache();
  }
}

function addValue(tName, mId) {
  const state = treatmentState[tName].metrics[mId];
  const val = state.currentValue.trim();
  if (val === '') return;
  if (!isValidInput(val)) {
    state.showError = true;
    setTimeout(() => { state.showError = false; }, 2000);
    if (window.__modal) window.__modal.showToast('只能输入非负数或00（空值）', 'error');
    return;
  }
  state.showError = false;
  state.values.push(val);
  state.currentValue = '';
  focusInput(tName, mId);
  saveCache();
}

function isValidInput(val) {
  if (/^0+$/.test(val)) return true;
  if (/^\d*\.?\d+$/.test(val)) {
    const num = Number(val);
    return num >= 0;
  }
  return false;
}

function addValueAndNext(tName, mId) {
  addValue(tName, mId);
  const metricIds = selectedMetrics.value.map(m => m.id);
  const idx = metricIds.indexOf(mId);
  if (idx < metricIds.length - 1) nextTick(() => focusInput(tName, metricIds[idx + 1]));
}

function editValue(tName, mId, idx) {
  const state = treatmentState[tName].metrics[mId];
  state.currentValue = state.values[idx];
  state.values.splice(idx, 1);
  focusInput(tName, mId);
  saveCache();
}

function modifyLast(tName, mId) {
  const state = treatmentState[tName].metrics[mId];
  if (state.values.length === 0) return;
  state.currentValue = state.values.pop();
  focusInput(tName, mId);
  saveCache();
}

function focusInput(tName, mId) {
  nextTick(() => {
    const el = valInputRefs[`${tName}_${mId}`];
    if (el) el.focus();
  });
}

function canSaveTreatment(tName) {
  const state = treatmentState[tName];
  for (const m of selectedMetrics.value) {
    if (state.metrics[m.id].values.length > 0) return true;
  }
  return false;
}

function getProgressClass(tName) {
  const state = treatmentState[tName];
  if (!state) return '';
  if (state.collapsed) return 'progress-done';
  for (const m of selectedMetrics.value) {
    if (state.metrics[m.id].values.length > 0) return 'progress-active';
  }
  return '';
}

function saveAndCollapseTreatment(tName) {
  const state = treatmentState[tName];

  let hasData = false;
  for (const m of selectedMetrics.value) {
    if (state.metrics[m.id].values.length > 0) {
      hasData = true;
      if (!state.savedMetricOrder.includes(m.id)) {
        state.savedMetricOrder.push(m.id);
      }
    }
  }

  if (!hasData) {
    if (window.__modal) window.__modal.showToast('请先输入数据', 'warning');
    return;
  }

  state.collapsed = true;
  saveCache();

  if (window.__modal) window.__modal.showToast(tName + ' 已暂存', 'success');
}


function expandTreatment(tName) {
  treatmentState[tName].collapsed = false;
}

function editSavedMetric(tName, mId) {
  const state = treatmentState[tName];
  const idx = state.savedMetricOrder.indexOf(mId);
  if (idx > -1) {
    state.savedMetricOrder.splice(idx, 1);
    saveCache();
  }
}

function confirmExitEntry() {
  let hasData = false;
  for (const tName of entryTreatmentOrder.value) {
    const state = treatmentState[tName];
    if (!state.collapsed) {
      for (const m of selectedMetrics.value) {
        if (state.metrics[m.id].values.length > 0) { hasData = true; break; }
      }
    }
    if (hasData) break;
  }
  if (hasData) {
    window.__modal?.showConfirm('有未保存的数据，确定退出？', '确认退出').then(ok => {
      if (ok) { dateSeqLocked.value = false; view.value = 'setup'; }
    });
  } else {
    dateSeqLocked.value = false;
    view.value = 'setup';
  }
}

async function finishEntry() {
  const recordDate = window.__sessionLockedDate;
  if (!recordDate) {
    if (window.__modal) window.__modal.showToast('会话已过期，请重新开始', 'error');
    return;
  }

  let unsavedTreatments = [];
  let emptyTreatments = [];

  for (const tName of entryTreatmentOrder.value) {
    const state = treatmentState[tName];
    const unsavedMetrics = getUnsavedMetrics(tName).filter(m => state.metrics[m.id].values.length > 0);
    
    if (unsavedMetrics.length > 0) {
      unsavedTreatments.push(tName + '(' + unsavedMetrics.map(m => getMetricFirstChar(m.id)).join(',') + ')');
    }
    
    const hasAnyData = selectedMetrics.value.some(m => state.metrics[m.id].values.length > 0);
    if (!hasAnyData && state.savedMetricOrder.length === 0) {
      emptyTreatments.push(tName);
    }
  }

  if (unsavedTreatments.length > 0) {
    if (window.__modal) window.__modal.showToast('请先保存所有数据: ' + unsavedTreatments.join(', '), 'warning');
    return;
  }

  if (emptyTreatments.length === entryTreatmentOrder.value.length) {
    if (window.__modal) window.__modal.showToast('没有数据需要保存', 'warning');
    return;
  }

  console.log('[DEBUG] finishEntry - 开始写入CSV, date:', recordDate);

  try {
    for (const tName of entryTreatmentOrder.value) {
      const state = treatmentState[tName];
      const metricValues = {};
      
      for (const m of selectedMetrics.value) {
        const vals = state.metrics[m.id].values;
        if (vals.length > 0) metricValues[m.id] = vals;
      }

      if (Object.keys(metricValues).length === 0) continue;

      await axios.post('/api/experiments/' + currentExp.value.id + '/records', {
        date: recordDate,
        treatment_name: tName,
        metric_values: metricValues,
        note: state.note || ''
      });
      
      console.log('[DEBUG] finishEntry - 已保存处理:', tName);
    }

    console.log('[DEBUG] finishEntry - 全部写入成功, 清理会话');

    clearCache();
    localStorage.removeItem('session_' + currentExp.value?.id);
    window.__sessionLockedDate = null;
    dateSeqLocked.value = false;

    if (window.__modal) window.__modal.showToast('数据已保存到CSV', 'success');
    view.value = 'list';
  } catch (err) {
    console.error('[DEBUG] finishEntry - 写入失败:', err);
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '保存失败', 'error');
  }
}


async function viewHistory(exp) {
  currentExp.value = exp;
  try {
    const res = await axios.get(`/api/experiments/${exp.id}/dates`);
    historyDates.value = res.data.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse();
  } catch (e) { historyDates.value = []; }
  showDateDetail.value = false;
  view.value = 'history';
}

async function viewDateData(date) {
  detailDate.value = date;
  try {
    const res = await axios.get(`/api/experiments/${currentExp.value.id}/records/${date}`);
    detailRecords.value = res.data;
    detailColumns.value = res.data.length > 0
      ? Object.keys(res.data[0]).filter(k => !['record_id', 'treatment', 'note', 'timestamp'].includes(k))
      : [];
  } catch (e) { detailRecords.value = []; detailColumns.value = []; }
  showDateDetail.value = true;
}

function formatDetailValue(val) {
  if (!val) return '-';
  return val.replace(/;/g, ', ');
}

// Group records by treatment for table view
const groupedByTreatment = computed(() => {
  const groups = {};
  for (const record of detailRecords.value) {
    const name = record.treatment || '未命名';
    if (!groups[name]) {
      // Calculate max repeats for this treatment
      let maxRepeats = 0;
      if (detailColumns.value.length > 0) {
        for (const col of detailColumns.value) {
          const vals = parseValues(record[col]);
          if (vals.length > maxRepeats) maxRepeats = vals.length;
        }
      }
      groups[name] = { name, record, maxRepeats: Math.max(maxRepeats, 1) };
    }
  }
  // Convert to array
  return Object.values(groups);
});

// Calculate max repeats globally (for column alignment)
const maxGlobalRepeats = computed(() => {
  let max = 0;
  for (const group of groupedByTreatment.value) {
    for (const col of detailColumns.value) {
      const vals = parseValues(group.record[col]);
      if (vals.length > max) max = vals.length;
    }
  }
  return Math.max(max, 1); // At least 1 column
});

// Parse semicolon-separated values into array
function parseValues(val) {
  if (!val) return [];
  return val.split(';').filter(v => v.trim() !== '');
}

// Get metric values for a specific record (wrapper for template use)
function getMetricValues(record, metric) {
  return parseValues(record[metric]);
}

function getMetricValue(record, metric, index) {
  const values = parseValues(record[metric]);
  return values[index - 1] || null;
}

function formatCellValue(val) {
  if (!val) return '-';
  if (typeof val === 'string' && val.length >= 2 && /^0+$/.test(val)) return '<span class="null-indicator">∅</span>';
  if (val.includes(';')) {
    const values = val.split(';').filter(v => v.trim());
    return values.map((v, i) => {
      if (typeof v === 'string' && v.length >= 2 && /^0+$/.test(v)) return `<span class="null-indicator">${i+1}:∅</span>`;
      return `${i+1}:${v}`;
    }).join('<br>');
  }
  return val;
}

function exportSingleDate(date) {
  window.open(`/api/experiments/${currentExp.value.id}/export?dates=${date}`);
}

async function deleteDateRecords(date) {
  if (!window.__modal) return;
  const ok1 = await window.__modal.showConfirm(`确定删除 ${date} 的所有数据？`, '删除确认 (1/3)');
  if (!ok1) return;
  const ok2 = await window.__modal.showConfirm('再次确认：此操作不可恢复！', '删除确认 (2/3)');
  if (!ok2) return;
  const text = await window.__modal.showPrompt(`请输入日期"${date}"确认删除`, '删除确认 (3/3)', { placeholder: date });
  if (text !== date) { window.__modal.showToast('输入不正确，已取消', 'error'); return; }
  try {
    await axios.delete(`/api/experiments/${currentExp.value.id}/records/${date}`);
    const res = await axios.get(`/api/experiments/${currentExp.value.id}/dates`);
    historyDates.value = res.data.sort().reverse();
    showDateDetail.value = false;
    window.__modal.showToast('已删除', 'success');
  } catch (err) {
    window.__modal.showToast(err.response?.data?.error || '删除失败', 'error');
  }
}

function openExport(exp) {
  currentExp.value = exp;
  exportDates.value = (exp.dates || []).slice().sort().reverse();
  selectedExportDates.value = [...exportDates.value];
  view.value = 'export';
}

async function doExport() {
  if (selectedExportDates.value.length === 0) return;
  window.open(`/api/experiments/${currentExp.value.id}/export?dates=${selectedExportDates.value.join(',')}`);
}

async function deleteExperiment(exp) {
  if (!window.__modal) return;
  const ok1 = await window.__modal.showConfirm(
    `确定删除"${exp.name}"？\n${exp.metrics?.length || 0}个指标、${exp.treatments?.length || 0}个处理、${exp.dates?.length || 0}个日期数据将全部删除！`,
    '删除确认 (1/3)'
  );
  if (!ok1) return;
  const ok2 = await window.__modal.showConfirm('再次确认：所有数据永久删除，无法恢复！', '删除确认 (2/3)');
  if (!ok2) return;
  const text = await window.__modal.showPrompt(`请输入"${exp.name}"确认删除`, '删除确认 (3/3)', { placeholder: exp.name });
  if (text !== exp.name) { window.__modal.showToast('输入不正确，已取消', 'error'); return; }
  try {
    await axios.delete(`/api/experiments/${exp.id}`);
    await loadExperiments();
    window.__modal.showToast('已删除', 'success');
  } catch (err) {
    window.__modal.showToast(err.response?.data?.error || '删除失败', 'error');
  }
}

onMounted(async () => {
  await store.fetchConfig();
  loadExperiments();
});
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.date-range-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.date-input {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.date-separator {
  font-size: 13px;
  color: var(--text-secondary);
}

.btn-clear {
  padding: 4px 8px;
  border: none;
  background: #ff5252;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-clear:hover {
  background: #ff1744;
}

.search-box {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text-primary);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.page-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.page-header h2 { flex: 1; font-size: 16px; margin: 0; min-width: 0; word-break: break-all; }
.compact-header { margin-bottom: 6px; }
.btn-back { background: none; border: none; font-size: 14px; color: var(--primary); cursor: pointer; font-weight: 600; white-space: nowrap; }

.empty-state { text-align: center; padding: 40px 16px; color: var(--text-secondary); }
.empty-icon { font-size: 40px; margin-bottom: 8px; }

.exp-card { margin-bottom: 8px; padding: 10px 12px; position: relative; }

.exp-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Small calendar badge - month + day */
.exp-calendar-sm {
  width: 48px;
  height: 32px;
  min-width: 48px;
  background: linear-gradient(135deg, var(--primary), #2d7d46);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(45, 125, 70, 0.3);
  flex-shrink: 0;
}

/* Center info area */
.exp-info-center {
  flex: 1;
  min-width: 0;
}

.exp-name { font-size: 14px; font-weight: 700; word-break: break-all; margin-bottom: 2px; }

/* Inline meta info */
.exp-meta-inline {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.exp-meta { display: flex; gap: 8px; margin-top: 4px; font-size: 11px; color: var(--text-secondary); flex-wrap: wrap; }

/* Inline action buttons for experiment card */
.exp-actions-inline {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

/* Small button size - enlarged */
.btn-sm {
  padding: 5px 12px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid;
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-sm:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.btn-primary.btn-sm {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.btn-primary.btn-sm:hover {
  background: #3a9055;
  border-color: #3a9055;
}

.btn-outline.btn-sm {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}

.btn-outline.btn-sm:hover {
  background: #f5f5f5;
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.create-progress { display: flex; gap: 12px; justify-content: center; margin-bottom: 10px; }
.progress-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-secondary); }
.progress-dot.active { border-color: var(--primary); color: var(--primary); background: rgba(45,125,70,0.08); }
.progress-dot.done { border-color: var(--success); color: white; background: var(--success); }

.selected-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.selected-item { display: flex; align-items: center; gap: 4px; padding: 3px 8px; background: #f0f7f0; border-radius: 4px; font-size: 12px; }
.btn-remove { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 14px; padding: 0 2px; }
.empty-hint { font-size: 12px; color: var(--text-secondary); padding: 4px 0; }
.custom-add { display: flex; gap: 6px; align-items: center; }

.compact-card { padding: 10px 12px; }
.form-group { margin-bottom: 10px; }
.form-label { display: block; font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.form-input, .form-select { width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; background: var(--bg-card); color: var(--text); }
.form-input:focus, .form-select:focus { outline: none; border-color: var(--primary); }
.form-input-sm { flex: 1; padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; min-width: 0; }

.name-error { color: #d32f2f; font-size: 11px; margin-top: 3px; }
.date-conflict { background: #fff3e0; border: 1px solid #ffb74d; border-radius: var(--radius-sm); padding: 5px 10px; font-size: 11px; color: #e65100; margin-top: 4px; }
.existing-dates { font-size: 10px; color: var(--text-secondary); margin-top: 3px; }
.date-info { font-size: 11px; color: #1976d2; margin-top: 4px; }

.checkbox-group { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
.checkbox-option { padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: all 0.15s; }
.checkbox-option.selected { border-color: var(--primary); background: rgba(45,125,70,0.08); color: var(--primary); font-weight: 600; }
.checkbox-option input { display: none; }

.add-form { background: #f8f9f8; padding: 8px; border-radius: var(--radius-sm); margin-top: 4px; }
.sheet-nav { display: flex; gap: 8px; margin-top: 10px; }

.entry-hint { background: #fff8e1; border: 1px solid #ffe082; border-radius: var(--radius-sm); padding: 6px 10px; font-size: 11px; color: #795548; margin-bottom: 6px; line-height: 1.5; }
.entry-progress { display: flex; gap: 5px; margin-bottom: 6px; flex-wrap: wrap; }
.progress-tag { padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; border: 1px solid var(--border); color: var(--text-secondary); }
.progress-done { background: #e8f5e9; border-color: var(--success); color: var(--success); }
.progress-active { background: #fff8e1; border-color: var(--accent); color: var(--accent); }

.treatment-card { margin-bottom: 6px; }
.treatment-name-sm { font-size: 13px; font-weight: 700; min-width: 40px; }
.done-square { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: var(--success); color: white; border-radius: 3px; font-size: 12px; font-weight: 700; cursor: pointer; }
.metric-square { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: var(--primary); color: white; border-radius: 3px; font-size: 11px; font-weight: 700; cursor: pointer; }
.metric-saved:hover { opacity: 0.8; transform: scale(1.1); }
.empty-square { display: inline-flex; width: 22px; height: 22px; border: 1px dashed var(--border); border-radius: 3px; }
.treatment-collapsed { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 2px 0; }
.treatment-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #f0f0f0; }
.btn-save { padding: 2px 10px; font-size: 11px; border: none; border-radius: 3px; background: var(--primary); color: white; cursor: pointer; font-weight: 600; margin-left: auto; }
.btn-save:disabled { opacity: 0.4; cursor: not-allowed; }

.metric-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 4px; min-height: 26px; }
.metric-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); min-width: 55px; white-space: nowrap; }
.values-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.value-chip { display: inline-flex; align-items: center; padding: 1px 6px; background: #f0f7f0; border-radius: 3px; font-size: 11px; cursor: pointer; }
.value-chip:hover { background: #e0efe0; }
.value-null { background: #fff3e0; color: #e65100; }
.val-input-group { display: flex; align-items: center; gap: 3px; }
.val-input { width: 50px; padding: 2px 5px; border: 1px solid var(--border); border-radius: 3px; font-size: 11px; text-align: center; }
.val-input:focus { outline: none; border-color: var(--primary); }
.val-input.input-error { border-color: #d32f2f; background: #ffebee; animation: shake 0.3s; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.input-error-msg { color: #d32f2f; font-size: 10px; margin: 2px 0 4px 55px; }
.btn-mini { padding: 2px 6px; font-size: 11px; border: none; border-radius: 3px; background: var(--primary); color: white; cursor: pointer; font-weight: 600; }
.btn-mini-outline { background: transparent; color: var(--primary); border: 1px solid var(--primary); }
.btn-mini-save { background: var(--accent); color: white; border: none; }

.note-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.note-input { flex: 1; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 12px; }
.note-input:focus { outline: none; border-color: var(--primary); }
.char-count { font-size: 10px; color: var(--text-secondary); white-space: nowrap; }

.history-card { margin-bottom: 6px; }
.history-header { display: flex; align-items: center; justify-content: space-between; }
.history-date { font-size: 14px; font-weight: 700; }
.history-actions {
  display: flex;
  gap: 3px;
  align-items: center;
}

.detail-record { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.detail-time { font-size: 10px; color: var(--text-secondary); }
.detail-table { width: 100%; font-size: 11px; }
.detail-table td { padding: 2px 6px; }
.detail-label { color: var(--text-secondary); white-space: nowrap; width: 80px; }
.detail-value { word-break: break-all; }

/* Data Preview Table Styles - Using CSS Grid for perfect alignment */
.table-container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin: 8px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  max-width: 100%;
}

.data-preview-grid {
  display: flex;
  flex-direction: column;
  min-width: max-content; /* 关键：允许内容超出并滚动 */
}

.grid-row {
  display: grid;
  grid-template-columns: 140px repeat(var(--grid-cols, 1), minmax(60px, 70px));
  border-bottom: 1px solid #f0f0f0;
  align-items: center;
}

.grid-header {
  background: #f0f7f0;
  border-bottom: 2px solid var(--primary);
}

.grid-data {
  border-bottom: 1px solid #f0f0f0;
}

.grid-data:hover {
  background: #fafafa;
}

.grid-note {
  background: #fff8e1;
  border-bottom: 1px solid var(--border);
}

.grid-cell {
  padding: 6px 4px;
  text-align: center;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-treatment-name {
  text-align: left !important;
  font-weight: 700;
  padding: 8px 10px !important;
  background: #f0f7f0;
  justify-self: start;
}

.treatment-icon {
  margin-right: 4px;
}

.cell-sequence {
  font-weight: 700;
  color: var(--primary) !important;
  padding: 8px 4px !important;
}

.cell-empty-seq {
  visibility: hidden; /* Hide empty sequence numbers but keep space */
}

.cell-metric-label {
  text-align: left !important;
  color: var(--text-secondary) !important;
  font-weight: 600;
  padding: 6px 10px !important;
  justify-self: start;
}

.cell-value {
  font-family: 'Courier New', monospace;
  padding: 6px 2px !important;
}

.cell-null {
  color: #ccc;
}

.null-indicator {
  color: #ff9800;
  font-weight: 700;
}

.cell-note {
  text-align: left !important;
  font-size: 11px;
  color: #795548;
  font-style: italic;
  padding: 6px 10px !important;
}

/* Note row */
.note-row {
  background: #fff8e1;
  border-bottom: 1px solid var(--border);
}

.cell-note {
  padding: 6px 12px;
  font-size: 11px;
  color: #795548;
  font-style: italic;
}

/* Mobile responsive */
@media (max-width: 600px) {
  .data-preview-grid {
    font-size: 10px;
  }

  .grid-row {
    grid-template-columns: 100px repeat(var(--grid-cols, 1), minmax(50px, 60px));
  }

  .cell-treatment-name,
  .cell-metric-label,
  .cell-note {
    padding: 4px 6px !important;
    font-size: 10px !important;
  }

  .cell-sequence,
  .cell-value {
    padding: 4px 2px !important;
    font-size: 10px !important;
  }
}

.export-select-actions { display: flex; gap: 6px; margin-top: 6px; }
.export-info { background: #f8f9f8; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 11px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.6; }
.export-info p { margin: 0; }

.bottom-sheet-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; }
.bottom-sheet { background: var(--bg-card); border-radius: 16px 16px 0 0; padding: 16px; width: 100%; max-width: 600px; max-height: 85vh; overflow-y: auto; }
.bottom-sheet-wide { max-height: 90vh; }
.bottom-sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 0 auto 12px; }
.bottom-sheet h3 { font-size: 15px; margin-bottom: 12px; }

.danger-text { color: var(--danger) !important; border-color: var(--danger) !important; }
.full-width { width: 100%; }
.empty { text-align: center; padding: 16px; color: var(--text-secondary); }

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 16px 0;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
