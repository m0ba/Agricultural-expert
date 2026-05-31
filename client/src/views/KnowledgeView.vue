<template>
  <div class="page knowledge-page">
    <h2>知识库</h2>

    <div class="tab-bar">
      <button class="tab" :class="{ active: activeTab === 'diseases' }" @click="activeTab = 'diseases'">病虫害</button>
      <button class="tab" :class="{ active: activeTab === 'pesticides' }" @click="activeTab = 'pesticides'">农药</button>
      <button class="tab" :class="{ active: activeTab === 'taxonomy' }" @click="activeTab = 'taxonomy'; loadTaxonomy()">科属常识</button>
    </div>

    <div v-if="activeTab === 'diseases'">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="diseaseSearch" class="form-input search-input" placeholder="搜索病虫害（名称 / 别名 / 症状）" @input="searchDiseases" />
        <button v-if="diseaseSearch" class="search-clear" @click="diseaseSearch = ''; searchDiseases()">✕</button>
      </div>
      <div class="chip-group disease-chips">
        <button class="chip" :class="{ active: diseaseCropFilter === '' && diseaseFamilyFilter === '' }" @click="diseaseCropFilter = ''; diseaseFamilyFilter = ''; searchDiseases()">全部</button>
        <button v-for="c in diseaseCrops" :key="c" class="chip" :class="{ active: diseaseCropFilter === c }" @click="diseaseCropFilter = c; diseaseFamilyFilter = ''; searchDiseases()">{{ c }}</button>
        <span class="chip-divider"></span>
        <button v-for="f in diseaseFamilies" :key="f.name" class="chip chip-family" :class="{ active: diseaseFamilyFilter === f.name }" @click="diseaseFamilyFilter = f.name; diseaseCropFilter = ''; searchDiseases()">{{ f.name }}</button>
      </div>

      <div v-for="d in paginatedDiseases" :key="d.key + d.crop" class="card disease-card" :class="{ expanded: d.expanded }" @click="toggleDisease(d)">
        <div class="card-header">
          <span class="disease-name">{{ d.name }}</span>
          <span v-if="d.alias" class="disease-alias">（{{ d.alias }}）</span>
          <span class="badge" :class="getPathogenBadge(d.pathogen_type)">{{ d.pathogen_type }}</span>
          <span class="expand-arrow">{{ d.expanded ? '▲' : '▼' }}</span>
        </div>
        <div class="card-meta">{{ d.pathogen_name }}</div>

        <div v-if="d.expanded" class="detail" @click.stop>
          <div v-if="d.symptoms && Object.keys(d.symptoms).length" class="section">
            <div class="section-title">症状</div>
            <div v-for="(desc, part) in d.symptoms" :key="part" class="symptom-row">
              <span class="part-tag">{{ getPartLabel(part) }}</span>{{ desc }}
            </div>
          </div>

          <div v-if="d.conditions" class="section">
            <div class="section-title">发病条件</div>
            <div class="cond-line" v-if="d.conditions.temperature">温度 {{ d.conditions.temperature }}</div>
            <div class="cond-line" v-if="d.conditions.humidity">湿度 {{ d.conditions.humidity }}</div>
            <div class="cond-line" v-if="d.conditions.season">{{ d.conditions.season }}</div>
            <div v-if="d.conditions.triggers?.length" class="trigger-tags">
              <span v-for="t in d.conditions.triggers" :key="t" class="trigger-tag">{{ t }}</span>
            </div>
          </div>

          <div class="control-row">
            <div v-if="d.agricultural_control?.length" class="control-col">
              <div class="section-title">农业防治</div>
              <ul class="simple-list">
                <li v-for="(ctrl, i) in d.agricultural_control" :key="i">{{ ctrl }}</li>
              </ul>
            </div>

            <div v-if="d.chemical_control?.length" class="control-col">
              <div class="section-title">化学防治</div>
              <div v-for="(ctrl, i) in d.chemical_control" :key="i" class="chem-row">
                <span class="chem-link" @click.stop="goToPesticide(ctrl.name)">{{ ctrl.name }}</span>
                <span class="chem-dil">{{ ctrl.dilution }}</span>
                <span v-if="ctrl.interval" class="chem-int">间隔{{ ctrl.interval }}</span>
              </div>
            </div>
          </div>

          <button class="btn btn-accent btn-sm action-btn" @click.stop="$router.push('/record')">打药防治此病害</button>
        </div>
      </div>

      <div v-if="filteredDiseases.length === 0" class="empty">未找到匹配的病虫害</div>
      <div v-if="diseaseTotalPages > 1" class="pagination">
        <button class="page-btn" :disabled="diseasePage === 1" @click="diseasePage--">‹</button>
        <button v-for="p in diseasePageNumbers" :key="p" class="page-btn" :class="{ active: diseasePage === p }" @click="diseasePage = p">{{ p }}</button>
        <button class="page-btn" :disabled="diseasePage === diseaseTotalPages" @click="diseasePage++">›</button>
      </div>
    </div>

    <div v-if="activeTab === 'pesticides'">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="pesticideSearch" class="form-input search-input" placeholder="搜索农药名称 / 防治对象" @input="searchPesticides" />
        <button v-if="pesticideSearch" class="search-clear" @click="pesticideSearch = ''; searchPesticides()">✕</button>
      </div>
      <div class="chip-group compact-chips">
        <button class="chip" :class="{ active: pesticideTypeFilter === '' }" @click="pesticideTypeFilter = ''; pesticidePage = 1; searchPesticides()">全部</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '杀菌剂' }" @click="pesticideTypeFilter = '杀菌剂'; pesticidePage = 1; searchPesticides()">杀菌剂</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '杀虫剂' }" @click="pesticideTypeFilter = '杀虫剂'; pesticidePage = 1; searchPesticides()">杀虫剂</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '细菌性杀菌剂' }" @click="pesticideTypeFilter = '细菌性杀菌剂'; pesticidePage = 1; searchPesticides()">细菌性</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '生物农药' }" @click="pesticideTypeFilter = '生物农药'; pesticidePage = 1; searchPesticides()">生物农药</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '抗病毒剂' }" @click="pesticideTypeFilter = '抗病毒剂'; pesticidePage = 1; searchPesticides()">抗病毒</button>
        <button class="chip" :class="{ active: pesticideTypeFilter === '叶面肥' }" @click="pesticideTypeFilter = '叶面肥'; pesticidePage = 1; searchPesticides()">叶面肥</button>
      </div>

      <div v-for="p in paginatedPesticides" :key="p.name" class="card pest-card" :class="{ expanded: p.expanded }" @click="togglePesticide(p)">
        <div class="card-header">
          <span class="pest-name">{{ p.name }}</span>
          <span class="badge" :class="getPestTypeBadge(p.type)">{{ p.type }}</span>
          <span class="safety-tag">{{ p.safety_interval_days }}天</span>
          <span class="expand-arrow">{{ p.expanded ? '▲' : '▼' }}</span>
        </div>
        <div v-if="p.active_ingredient" class="pest-ingredient">主要成分：{{ p.active_ingredient }}</div>

        <div v-if="p.expanded" class="detail" @click.stop>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">防治对象</span>
              <span class="info-value">{{ (p.control_targets || []).join('、') }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">稀释</span>
              <span class="info-value">{{ p.dilution }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">用量</span>
              <span class="info-value">{{ p.dosage }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">安全间隔</span>
              <span class="info-value">{{ p.safety_interval_days }}天</span>
            </div>
          </div>

          <div v-if="p.contraindications" class="warn-box">
            <div class="warn-title">使用禁忌</div>
            <div v-if="p.contraindications.weather?.length">天气：{{ p.contraindications.weather.join('、') }}</div>
            <div v-if="p.contraindications.temperature?.max">温度上限：{{ p.contraindications.temperature.max }}°C</div>
            <div v-if="p.contraindications.notes" class="warn-notes">{{ p.contraindications.notes }}</div>
          </div>
        </div>

        <div v-if="isWeatherContraindicated(p)" class="weather-warn">
          当前天气条件下不建议使用！
        </div>
      </div>

      <div v-if="filteredPesticides.length === 0" class="empty">未找到匹配的农药</div>
      <div v-if="pesticideTotalPages > 1" class="pagination">
        <button class="page-btn" :disabled="pesticidePage === 1" @click="pesticidePage--">‹</button>
        <button v-for="p in pesticidePageNumbers" :key="p" class="page-btn" :class="{ active: pesticidePage === p }" @click="pesticidePage = p">{{ p }}</button>
        <button class="page-btn" :disabled="pesticidePage === pesticideTotalPages" @click="pesticidePage++">›</button>
      </div>
    </div>

    <div v-if="activeTab === 'taxonomy'">
      <div class="chip-group">
        <button v-for="t in taxonomyList" :key="t.family" class="chip" :class="{ active: activeTaxonomy === t.family }" @click="activeTaxonomy = t.family">{{ t.family }}</button>
      </div>

      <div v-if="currentTaxonomy" class="card taxonomy-card">
        <div class="taxonomy-header">
          <span class="taxonomy-name">{{ currentTaxonomy.family }}</span>
          <span v-if="currentTaxonomy.latin_name" class="taxonomy-latin">{{ currentTaxonomy.latin_name }}</span>
        </div>

        <div v-if="currentTaxonomy.common_traits" class="taxonomy-section">
          <div class="section-title">生长特性</div>
          <div class="trait-grid">
            <div v-for="(val, key) in currentTaxonomy.common_traits" :key="key" class="trait-item">
              <span class="trait-label">{{ getTraitLabel(key) }}</span>
              <span class="trait-value">{{ val }}</span>
            </div>
          </div>
        </div>

        <div v-if="currentTaxonomy.common_diseases?.length" class="taxonomy-section">
          <div class="section-title">常见病害</div>
          <div class="tag-list">
            <span v-for="d in currentTaxonomy.common_diseases" :key="d" class="disease-tag">{{ d }}</span>
          </div>
        </div>

        <div v-if="currentTaxonomy.common_pests?.length" class="taxonomy-section">
          <div class="section-title">常见虫害</div>
          <div class="tag-list">
            <span v-for="p in currentTaxonomy.common_pests" :key="p" class="pest-tag">{{ p }}</span>
          </div>
        </div>

        <div v-if="currentTaxonomy.management_points?.length" class="taxonomy-section">
          <div class="section-title">管理要点</div>
          <ul class="simple-list">
            <li v-for="(m, i) in currentTaxonomy.management_points" :key="i">{{ m }}</li>
          </ul>
        </div>

        <div v-if="currentTaxonomy.crops?.length" class="taxonomy-section">
          <div class="section-title">包含作物</div>
          <div class="tag-list">
            <span v-for="c in currentTaxonomy.crops" :key="c" class="crop-tag">{{ c }}</span>
          </div>
        </div>
      </div>

      <div v-if="!currentTaxonomy" class="empty">请选择一个科属类别</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const store = useAppStore();
const weather = computed(() => store.weather);
const activeTab = ref('diseases');

const diseases = ref([]);
const diseaseSearch = ref('');
const diseaseCropFilter = ref('');
const diseaseFamilyFilter = ref('');
const diseasePage = ref(1);
const diseaseCrops = ['番茄', '黄瓜', '辣椒'];
const diseaseFamilies = [
  { name: '茄科', crops: ['番茄', '辣椒', '茄子'] },
  { name: '葫芦科', crops: ['黄瓜', '南瓜', '西葫芦', '苦瓜'] },
  { name: '十字花科', crops: ['大白菜', '甘蓝', '花椰菜', '西兰花', '萝卜'] },
  { name: '叶菜类', crops: ['生菜', '油菜', '菠菜', '芹菜', '空心菜', '茼蒿', '苋菜', '小白菜'] }
];

const filteredDiseases = computed(() => {
  let list = diseases.value;
  if (diseaseCropFilter.value) {
    list = list.filter(d => d.crop === diseaseCropFilter.value);
  } else if (diseaseFamilyFilter.value) {
    const family = diseaseFamilies.find(f => f.name === diseaseFamilyFilter.value);
    if (family) list = list.filter(d => family.crops.includes(d.crop));
  }
  return list;
});

const diseaseTotalPages = computed(() => Math.ceil(filteredDiseases.value.length / 10));
const paginatedDiseases = computed(() => {
  const start = (diseasePage.value - 1) * 10;
  return filteredDiseases.value.slice(start, start + 10);
});
const diseasePageNumbers = computed(() => {
  const pages = [];
  for (let i = 1; i <= diseaseTotalPages.value; i++) pages.push(i);
  return pages;
});

const pesticides = ref([]);
const pesticideSearch = ref('');
const pesticideTypeFilter = ref('');
const pesticidePage = ref(1);

const taxonomyList = ref([]);
const activeTaxonomy = ref('');
const currentTaxonomy = computed(() => taxonomyList.value.find(t => t.family === activeTaxonomy.value) || null);

const filteredPesticides = computed(() => {
  let list = pesticides.value;
  if (pesticideTypeFilter.value) list = list.filter(p => p.type === pesticideTypeFilter.value);
  return list;
});

const pesticideTotalPages = computed(() => Math.ceil(filteredPesticides.value.length / 10));
const paginatedPesticides = computed(() => {
  const start = (pesticidePage.value - 1) * 10;
  return filteredPesticides.value.slice(start, start + 10);
});
const pesticidePageNumbers = computed(() => {
  const pages = [];
  for (let i = 1; i <= pesticideTotalPages.value; i++) pages.push(i);
  return pages;
});

async function searchDiseases() {
  try {
    const params = {};
    if (diseaseSearch.value) params.q = diseaseSearch.value;
    if (diseaseCropFilter.value) {
      params.crop = diseaseCropFilter.value;
    } else if (diseaseFamilyFilter.value) {
      params.family = diseaseFamilyFilter.value;
    }
    const res = await axios.get('/api/knowledge/diseases', { params });
    diseases.value = res.data.map(d => ({ ...d, expanded: false }));
    diseasePage.value = 1;
  } catch (e) {}
}

async function searchPesticides() {
  try {
    const params = {};
    if (pesticideSearch.value) params.q = pesticideSearch.value;
    if (pesticideTypeFilter.value) params.type = pesticideTypeFilter.value;
    const res = await axios.get('/api/knowledge/pesticides', { params });
    pesticides.value = res.data.map(p => ({ ...p, expanded: false }));
    pesticidePage.value = 1;
  } catch (e) {}
}

async function loadTaxonomy() {
  if (taxonomyList.value.length > 0) return;
  try {
    const families = ['茄科', '葫芦科', '十字花科', '叶菜类'];
    const results = [];
    for (const f of families) {
      try {
        const res = await axios.get(`/api/knowledge/taxonomy/${f}`);
        results.push(res.data);
      } catch (e) {}
    }
    taxonomyList.value = results;
    if (results.length > 0) activeTaxonomy.value = results[0].family;
  } catch (e) {}
}

function getTraitLabel(key) {
  const map = { temperature: '温度', humidity: '湿度', light: '光照', soil: '土壤', water: '水分' };
  return map[key] || key;
}

function toggleDisease(d) { d.expanded = !d.expanded; }
function togglePesticide(p) { p.expanded = !p.expanded; }

function goToPesticide(name) {
  activeTab.value = 'pesticides';
  pesticideSearch.value = name;
  pesticideTypeFilter.value = '';
  pesticidePage.value = 1;
  searchPesticides();
}

function getPathogenBadge(type) {
  const map = { '真菌': 'badge-fungus', '细菌': 'badge-bacteria', '病毒': 'badge-virus', '虫害': 'badge-pest', '生理性': 'badge-physio' };
  return map[type] || '';
}

function getPestTypeBadge(type) {
  const map = { '杀菌剂': 'badge-fungicide', '杀虫剂': 'badge-insecticide', '细菌性杀菌剂': 'badge-bactericide', '生物农药': 'badge-bio', '抗病毒剂': 'badge-antivirus', '叶面肥': 'badge-fertilizer' };
  return map[type] || 'badge-other';
}

function getPartLabel(part) {
  const map = { stem: '茎', leaf: '叶', fruit: '果', flower: '花', root: '根', plant: '株' };
  return map[part] || part;
}

function isWeatherContraindicated(pesticide) {
  if (!weather.value?.merged) return false;
  const w = weather.value.merged;
  const c = pesticide.contraindications;
  if (!c) return false;
  if (c.weather?.includes('雨天') && (w.precipitation ?? 0) > 0) return true;
  if (c.weather?.includes('大风') && (w.wind_speed ?? 0) > 8) return true;
  if (c.temperature?.max && (w.temperature ?? 0) > c.temperature.max) return true;
  return false;
}

onMounted(() => {
  searchDiseases();
  searchPesticides();
  store.fetchWeather();
});
</script>

<style scoped>
.knowledge-page h2 {
  font-size: 20px;
  margin-bottom: 16px;
}

.tab-bar {
  display: flex;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border);
}
.tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.2s;
}
.tab.active {
  color: var(--primary);
  border-bottom: 2px solid var(--primary);
  margin-bottom: -2px;
}

.search-box {
  position: relative;
  margin-bottom: 12px;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  pointer-events: none;
}
.search-input {
  padding-left: 36px !important;
  padding-right: 36px !important;
}
.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
}

.chip-divider {
  width: 1px;
  height: 60%;
  background: var(--border);
  align-self: center;
}
.chip-family {
  background: #f0f7f0;
  border-color: var(--primary-light);
}

.disease-card, .pest-card {
  cursor: pointer;
  transition: border-color 0.2s;
  border: 1px solid transparent;
}
.disease-card.expanded, .pest-card.expanded {
  border-color: var(--primary-light);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.disease-name, .pest-name {
  font-weight: 700;
  font-size: 15px;
}
.disease-alias {
  font-size: 12px;
  color: var(--text-secondary);
}
.expand-arrow {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-secondary);
}
.card-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  font-style: italic;
}
.safety-tag {
  font-size: 12px;
  color: var(--accent);
  margin-left: auto;
}
.pest-ingredient {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  padding-left: 2px;
}

.badge-fungus { background: #e8eaf6; color: #5c6bc0; }
.badge-bacteria { background: #fff8e1; color: #f9a825; }
.badge-virus { background: #ffebee; color: #c62828; }
.badge-pest { background: #e3f2fd; color: #1565c0; }
.badge-physio { background: #e0e0e0; color: #616161; }
.badge-fungicide { background: #e8eaf6; color: #5c6bc0; }
.badge-insecticide { background: #e3f2fd; color: #1565c0; }
.badge-bactericide { background: #fff3e0; color: #e65100; }
.badge-bio { background: #e8f5e9; color: #2e7d32; }
.badge-antivirus { background: #fce4ec; color: #c62828; }
.badge-fertilizer { background: #f3e5f5; color: #7b1fa2; }
.badge-other { background: #f5f5f5; color: #616161; }

.detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.section {
  margin-bottom: 12px;
}
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-dark);
  margin-bottom: 6px;
}

.control-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.control-col {
  flex: 1;
  min-width: 0;
}

.symptom-row {
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 2px;
}
.part-tag {
  display: inline-block;
  padding: 0 6px;
  background: #fff3e0;
  color: #e65100;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-right: 4px;
}

.cond-line {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.trigger-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.trigger-tag {
  padding: 1px 8px;
  background: #fce4ec;
  color: #c62828;
  border-radius: 10px;
  font-size: 11px;
}

.simple-list {
  list-style: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text);
}
.simple-list li::before {
  content: '·';
  margin-right: 6px;
  color: var(--primary);
  font-weight: 700;
}

.chem-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 1.8;
}
.chem-link {
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.chem-link:hover {
  color: var(--primary-dark);
}
.chem-dil {
  color: var(--text-secondary);
}
.chem-int {
  color: var(--text-secondary);
  font-size: 12px;
}

.action-btn {
  width: 100%;
  margin-top: 8px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 16px;
  padding: 8px 0;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}
.page-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.disease-chips .chip {
  font-size: 13px;
  padding: 5px 10px;
}
.compact-chips .chip {
  padding: 6px 12px;
  font-size: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  font-size: 13px;
}
.info-item {
  display: flex;
  gap: 6px;
  line-height: 1.8;
}
.info-label {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.info-value {
  font-weight: 500;
}

.warn-box {
  margin-top: 10px;
  padding: 8px 10px;
  background: #fff3e0;
  border-left: 3px solid var(--accent);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.6;
}
.warn-title {
  font-weight: 700;
  color: #e65100;
  margin-bottom: 2px;
}
.warn-notes {
  color: var(--accent);
  font-style: italic;
}

.weather-warn {
  margin-top: 8px;
  padding: 6px 10px;
  background: #ffebee;
  color: var(--danger);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.empty {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
  font-size: 14px;
}

.taxonomy-card {
  border: 1px solid var(--border);
}
.taxonomy-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.taxonomy-name {
  font-weight: 700;
  font-size: 16px;
}
.taxonomy-latin {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}
.taxonomy-section {
  margin-bottom: 12px;
}
.taxonomy-section .section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-dark);
  margin-bottom: 6px;
}
.trait-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  font-size: 13px;
}
.trait-item {
  display: flex;
  gap: 6px;
  line-height: 1.8;
}
.trait-label {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.trait-value {
  font-weight: 500;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.disease-tag {
  padding: 2px 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 12px;
  font-size: 12px;
}
.pest-tag {
  padding: 2px 10px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 12px;
  font-size: 12px;
}
.crop-tag {
  padding: 2px 10px;
  background: #e8f5e9;
  color: var(--primary);
  border-radius: 12px;
  font-size: 12px;
}
</style>