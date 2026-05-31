<template>
  <div class="setup-wizard">
    <!-- Progress bar -->
    <div class="wizard-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: (step / 6 * 100) + '%' }"></div>
      </div>
      <div class="step-labels">
        <span v-for="i in 6" :key="i" :class="{ active: i === step, done: i < step }">{{ stepNames[i-1] }}</span>
      </div>
    </div>

    <!-- Error toast (auto-dismiss) -->

    <!-- Step 1: 种植基础信息 -->
    <div v-if="step === 1" class="wizard-step">
      <h2>种植基础信息</h2>

      <div class="form-group">
        <label class="form-label">种植模式</label>
        <div class="option-cards">
          <div v-for="mode in ['设施大棚', '露天种植']" :key="mode"
            class="option-card" :class="{ selected: form.cultivation_mode === mode }"
            @click="form.cultivation_mode = mode">
            {{ mode }}
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">所在城市</label>
        <div class="city-row">
          <input v-model="form.city" class="form-input city-select" list="city-suggestions" placeholder="输入城市名或点击自动定位" />
          <datalist id="city-suggestions">
            <option v-for="c in cities" :key="c" :value="c" />
          </datalist>
          <button class="btn btn-outline btn-sm" @click="detectLocation" :disabled="locating">{{ locating ? '定位中...' : '自动定位' }}</button>
        </div>
        <div class="location-info" v-if="form.city_source">
          <span class="loc-item">源：{{ form.city_source }}</span>
          <span class="loc-item" v-if="gpsCoords">GPS：{{ gpsCoords }}</span>
          <span class="loc-item" v-if="detectedIP">IP：{{ detectedIP }}</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">种植规模</label>
        <select v-model="form.scale" class="form-select">
          <option value="">请选择</option>
          <option value="小型(1-2棚)">小型(1-2棚)</option>
          <option value="中型(3-5棚)">中型(3-5棚)</option>
          <option value="大型(6棚+)">大型(6棚+)</option>
        </select>
      </div>
    </div>

    <!-- Step 2: 配置棚区 -->
    <div v-if="step === 2" class="wizard-step">
      <h2>配置棚区</h2>
      <p class="hint">可添加多个棚区</p>

      <div v-for="(gh, idx) in form.greenhouses" :key="idx" class="greenhouse-card card">
        <div class="card-header">
          <span>棚区 {{ idx + 1 }}</span>
          <button v-if="form.greenhouses.length > 1" class="btn-icon danger" @click="form.greenhouses.splice(idx, 1)">删除</button>
        </div>

        <div class="form-group">
          <label class="form-label">棚区名称</label>
          <input v-model="gh.name" class="form-input" maxlength="8" placeholder="最多8个字，支持中英文和数字" />
        </div>

        <div class="form-group">
          <label class="form-label">面积 (m²)</label>
          <div class="stepper">
            <button class="stepper-btn" @click="stepValue(gh, 'area', -50, 100, 5000)">-</button>
            <span class="stepper-value">{{ gh.area }}</span>
            <button class="stepper-btn" @click="stepValue(gh, 'area', 50, 100, 5000)">+</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">棚型</label>
          <select v-model="gh.type" class="form-select">
            <option v-for="t in ['日光温室', '大拱棚', '连栋温室', '简易棚']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">棚体朝向</label>
          <select v-model="gh.orientation" class="form-select">
            <option v-for="t in ['东西走向', '南北走向']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">覆盖材料</label>
          <select v-model="gh.cover_material" class="form-select">
            <option v-for="t in ['PO膜', 'PE膜', '玻璃', 'PC板']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">保温能力</label>
          <select v-model="gh.insulation" class="form-select">
            <option value="好（有加温设备）">好（有加温设备）</option>
            <option value="一般">一般</option>
            <option value="差">差</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">通风方式</label>
          <select v-model="gh.ventilation" class="form-select">
            <option v-for="t in ['自然通风', '机械通风', '两者结合']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">灌溉方式</label>
          <select v-model="gh.irrigation" class="form-select">
            <option v-for="t in ['滴灌', '喷灌', '沟灌', '人工浇灌']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label class="form-label">加温设备</label>
            <select v-model="gh.heating" class="form-select">
              <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group half">
            <label class="form-label">遮阳设备</label>
            <select v-model="gh.shading" class="form-select">
              <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">防虫网</label>
          <select v-model="gh.insect_net" class="form-select">
            <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <button class="btn btn-outline full-width" @click="addGreenhouse">+ 添加棚区</button>
    </div>

    <!-- Step 3: 添加作物品种 -->
    <div v-if="step === 3" class="wizard-step">
      <h2>添加作物品种</h2>

      <div v-for="(crop, idx) in form.crops" :key="idx" class="crop-card card">
        <div class="card-header">
          <span>作物 {{ idx + 1 }}</span>
          <button v-if="form.crops.length > 1" class="btn-icon danger" @click="form.crops.splice(idx, 1)">删除</button>
        </div>

        <div class="form-group">
          <label class="form-label">所属棚区</label>
          <select v-model="crop.greenhouse_id" class="form-select">
            <option value="">请选择棚区</option>
            <option v-for="gh in form.greenhouses" :key="gh.id || gh.name" :value="gh.id || gh.name">{{ gh.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">作物类型</label>
          <select v-model="crop.crop_type" class="form-select" @change="onCropTypeChange(crop)">
            <option value="">请选择作物类型</option>
            <option v-for="ct in allCropTypes" :key="ct" :value="ct">{{ ct }}</option>
            <option value="其他">其他（自定义）</option>
          </select>
        </div>

        <div v-if="crop.crop_type === '其他'" class="form-group">
          <label class="form-label">自定义作物名称</label>
          <input v-model="crop.custom_name" class="form-input" maxlength="8" placeholder="最多8个字" />
        </div>

        <div class="form-group">
          <label class="form-label">品种名称</label>
          <select v-model="crop.variety_name" class="form-select">
            <option value="">请选择品种</option>
            <option v-for="v in getVarieties(crop.crop_type)" :key="v.name" :value="v.name">{{ v.name }}</option>
            <option value="其他">其他</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">定植日期</label>
          <input type="date" v-model="crop.planting_date" class="form-input" />
        </div>

        <div class="form-group">
          <label class="form-label">当前生长阶段</label>
          <select v-model="crop.current_stage" class="form-select" @change="onStageChange(crop)">
            <option v-for="s in getStages(crop.crop_type)" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- Stage detail fields (dynamic) -->
        <div v-if="crop.current_stage && getStageDetailFields(crop.crop_type, crop.current_stage).length > 0" class="stage-detail">
          <h4>{{ crop.current_stage }}详情</h4>
          <div v-for="field in getStageDetailFields(crop.crop_type, crop.current_stage)" :key="field.name" class="form-group">
            <label class="form-label">{{ field.name }}{{ field.unit ? ` (${field.unit})` : '' }}</label>
            <div v-if="field.type === 'stepper'" class="stepper">
              <button class="stepper-btn" @click="stepValue(crop.stage_detail, field.name, -(field.step || 1), field.min || 0, field.max || 9999)">-</button>
              <span class="stepper-value">{{ crop.stage_detail[field.name] ?? field.min ?? 0 }}</span>
              <button class="stepper-btn" @click="stepValue(crop.stage_detail, field.name, field.step || 1, field.min || 0, field.max || 9999)">+</button>
            </div>
            <select v-else-if="field.type === 'select'" v-model="crop.stage_detail[field.name]" class="form-select">
              <option value="">请选择</option>
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">种植数量 (株)</label>
          <div class="stepper">
            <button class="stepper-btn" @click="stepValue(crop, 'quantity', -100, 100, 50000)">-</button>
            <span class="stepper-value">{{ crop.quantity }}</span>
            <button class="stepper-btn" @click="stepValue(crop, 'quantity', 100, 100, 50000)">+</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">种子来源</label>
          <select v-model="crop.seed_source" class="form-select">
            <option v-for="t in ['国产品种', '进口品种', '自留种']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">育苗方式</label>
          <select v-model="crop.nursery_method" class="form-select">
            <option v-for="t in ['自育苗', '外购苗']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <div v-if="crop.nursery_method === '外购苗'" class="form-group">
          <label class="form-label">苗龄 (天)</label>
          <div class="stepper">
            <button class="stepper-btn" @click="stepValue(crop, 'seedling_age', -1, 1, 90)">-</button>
            <span class="stepper-value">{{ crop.seedling_age || 15 }}</span>
            <button class="stepper-btn" @click="stepValue(crop, 'seedling_age', 1, 1, 90)">+</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">是否嫁接</label>
          <div class="radio-group">
            <label v-for="t in ['是', '否']" :key="t" class="radio-option" :class="{ selected: crop.grafted === t }">
              <input type="radio" v-model="crop.grafted" :value="t" /> {{ t }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">上茬作物</label>
          <select v-model="crop.prev_crop" class="form-select" @change="checkRotation(crop)">
            <option value="">请选择</option>
            <option v-for="ct in allCropTypes" :key="ct" :value="ct">{{ ct }}</option>
            <option value="首次种植">首次种植</option>
          </select>
          <div v-if="crop.rotation_hint" class="rotation-hint" :class="crop.rotation_ok ? 'ok' : 'warn'">
            {{ crop.rotation_hint }}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">目标产量 (斤/亩) <span class="optional">可选</span></label>
          <div class="stepper">
            <button class="stepper-btn" @click="stepValue(crop, 'target_yield', -100, 0, 99999)">-</button>
            <span class="stepper-value">{{ crop.target_yield || '未设置' }}</span>
            <button class="stepper-btn" @click="stepValue(crop, 'target_yield', 100, 0, 99999)">+</button>
          </div>
        </div>
      </div>

      <button class="btn btn-outline full-width" @click="addCrop">+ 添加作物</button>
    </div>

    <!-- Step 4: 栽培条件 -->
    <div v-if="step === 4" class="wizard-step">
      <h2>栽培条件</h2>

      <div class="form-group">
        <label class="form-label">栽培方式</label>
        <select v-model="form.cultivation_method" class="form-select">
          <option v-for="t in ['土壤栽培', '基质栽培', '水培(NFT)', '水培(DWC)', '气雾培']" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <!-- Soil cultivation fields -->
      <div v-if="form.cultivation_method === '土壤栽培'" class="sub-form">
        <h4>土壤条件</h4>
        <div class="form-group">
          <label class="form-label">土壤类型</label>
          <select v-model="form.soil.soil_type" class="form-select">
            <option v-for="t in ['沙土', '沙壤土', '壤土', '黏壤土', '黏土']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">土壤pH</label>
          <select v-model="form.soil.ph" class="form-select">
            <option v-for="t in ['偏酸(<6.0)', '适中(6.0-7.0)', '偏碱(>7.0)', '未测过']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">有机质含量</label>
          <select v-model="form.soil.organic" class="form-select">
            <option v-for="t in ['高', '中', '低', '未检测']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">土壤改良</label>
          <select v-model="form.soil.amendment" class="form-select">
            <option v-for="t in ['未改良', '施有机肥', '客土', '深翻']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <!-- Substrate cultivation fields -->
      <div v-if="form.cultivation_method === '基质栽培'" class="sub-form">
        <h4>基质条件</h4>
        <div class="form-group">
          <label class="form-label">基质种类</label>
          <select v-model="form.substrate.type" class="form-select">
            <option v-for="t in ['椰糠', '珍珠岩', '蛭石', '岩棉', '混合基质', '其他']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">基质使用年限</label>
          <select v-model="form.substrate.years" class="form-select">
            <option v-for="t in ['第1年', '第2年', '第3年及以上']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">袋/槽规格</label>
          <select v-model="form.substrate.spec" class="form-select">
            <option v-for="t in ['标准袋(1m)', '加长袋(1.2m)', '槽式', '管道式']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <!-- Water-fertilizer integration -->
      <div class="sub-form">
        <h4>水肥一体化</h4>
        <div class="form-group">
          <label class="form-label">是否水肥一体化</label>
          <select v-model="form.water_fertilizer.enabled" class="form-select">
            <option value="是">是</option>
            <option value="否">否</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">施肥方式</label>
          <select v-model="form.water_fertilizer.method" class="form-select">
            <option v-for="t in ['随水滴灌', '人工撒施', '叶面喷施', '自动配肥机']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">水源类型</label>
          <select v-model="form.water_fertilizer.water_source" class="form-select">
            <option v-for="t in ['井水', '河水', '自来水', '收集雨水']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">水质情况</label>
          <select v-model="form.water_fertilizer.water_quality" class="form-select">
            <option v-for="t in ['良好', '一般(有水垢)', '较差(含盐高)', '未检测']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <!-- Equipment: 手动/自动二选一 -->
      <div class="sub-form">
        <h4>设施设备</h4>
        <div class="form-group">
          <label class="form-label">设备模式</label>
          <div class="radio-group">
            <label class="radio-option" :class="{ selected: form.equipment_mode === 'manual' }" @click="form.equipment_mode = 'manual'">
              <input type="radio" v-model="form.equipment_mode" value="manual" /> 手动操作
            </label>
            <label class="radio-option" :class="{ selected: form.equipment_mode === 'auto' }" @click="form.equipment_mode = 'auto'">
              <input type="radio" v-model="form.equipment_mode" value="auto" /> 自动化设备
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">温控</label>
          <select v-model="form.equipment.temp" class="form-select">
            <option v-for="t in ['无', '有(仅加温)', '有(仅降温)', '有(双向)']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">通风</label>
          <select v-model="form.equipment.vent" class="form-select">
            <option v-for="t in ['无', '有(侧窗)', '有(顶窗)', '有(风机)']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">补光设备</label>
          <select v-model="form.equipment.light" class="form-select">
            <option v-for="t in ['无', '有(LED)', '有(钠灯)', '有(其他)']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">CO2补充</label>
          <select v-model="form.equipment.co2" class="form-select">
            <option v-for="t in ['无', '有(钢瓶)', '有(燃烧法)', '有(生物法)']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">环境监测</label>
          <select v-model="form.equipment.monitor" class="form-select">
            <option v-for="t in ['无', '温度计', '温湿度计', '有传感器系统']" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Step 5: 历史问题 -->
    <div v-if="step === 5" class="wizard-step">
      <h2>历史问题 <span class="optional">(可选跳过)</span></h2>

      <div class="form-group">
        <label class="form-label">上年主要病害</label>
        <div class="checkbox-group">
          <label v-for="d in diseaseOptions" :key="d" class="checkbox-option" :class="{ selected: form.history.diseases?.includes(d) }">
            <input type="checkbox" :value="d" v-model="form.history.diseases" /> {{ d }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">上年最大损失</label>
        <div class="radio-group">
          <label v-for="t in lossOptions" :key="t" class="radio-option" :class="{ selected: form.history.max_loss === t }">
            <input type="radio" v-model="form.history.max_loss" :value="t" /> {{ t }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">最想解决的问题</label>
        <div class="checkbox-group">
          <label v-for="p in problemOptions" :key="p" class="checkbox-option" :class="{ selected: form.history.problems?.includes(p) }">
            <input type="checkbox" :value="p" v-model="form.history.problems" /> {{ p }}
          </label>
        </div>
      </div>

      <button class="btn btn-outline full-width" @click="skipStep5">跳过此步</button>
    </div>

    <!-- Step 6: AI 配置 -->
    <div v-if="step === 6" class="wizard-step">
      <h2>AI 配置</h2>

      <div class="form-group">
        <label class="form-label">启用 AI</label>
        <div class="switch-container">
          <label class="switch">
            <input type="checkbox" v-model="form.ai.enabled" />
            <span class="switch-slider"></span>
          </label>
          <span>{{ form.ai.enabled ? '已启用' : '未启用' }}</span>
        </div>
      </div>

      <div v-if="form.ai.enabled">
        <div class="form-group">
          <label class="form-label">AI 接口地址</label>
          <input v-model="form.ai.api_base" class="form-input" placeholder="https://api.openai.com/v1" />
        </div>

        <div class="form-group">
          <label class="form-label">API 密钥</label>
          <input v-model="form.ai.api_key" class="form-input" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." />
          <button class="btn-icon" @click="showApiKey = !showApiKey">{{ showApiKey ? '隐藏' : '显示' }}</button>
        </div>

        <div class="form-group">
          <label class="form-label">模型名称</label>
          <input v-model="form.ai.model" class="form-input" placeholder="如 gpt-4o" />
        </div>

        <button class="btn btn-outline" @click="testAI" :disabled="aiTesting">
          {{ aiTesting ? '测试中...' : '测试连接' }}
        </button>

        <div v-if="aiTestResult" class="card" :class="aiTestResult.success ? 'success' : 'error'">
          <div v-if="aiTestResult.success">
            <div>模型：{{ aiTestResult.model }}</div>
            <div>响应时间：{{ aiTestResult.responseTime }}ms</div>
            <div>回复：{{ aiTestResult.reply }}</div>
          </div>
          <div v-else class="error-message">{{ aiTestResult.error }}</div>
        </div>
      </div>
    </div>

    <!-- Navigation buttons -->
    <div class="wizard-nav">
      <button v-if="step > 1" class="btn btn-outline" @click="prevStep">上一步</button>
      <div class="spacer"></div>
      <button v-if="step < 6" class="btn btn-primary" @click="nextStep">下一步</button>
      <button v-if="step === 6" class="btn btn-accent" @click="confirmFinish" :disabled="submitting">
        {{ submitting ? '保存中...' : '完成配置' }}
      </button>
    </div>

    <!-- Confirm dialog -->
    <div v-if="showConfirm" class="bottom-sheet-overlay" @click="showConfirm = false">
      <div class="bottom-sheet" @click.stop>
        <div class="bottom-sheet-handle"></div>
        <h3>确认完成配置？</h3>
        <p>确认后将保存所有配置信息。</p>
        <div class="confirm-actions">
          <button class="btn btn-outline" @click="showConfirm = false">取消</button>
          <button class="btn btn-primary" @click="submitInit">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app.js';
import axios from 'axios';

const router = useRouter();
const store = useAppStore();

const step = ref(1);
const error = ref('');
const showConfirm = ref(false);
const submitting = ref(false);
const showApiKey = ref(false);
const aiTesting = ref(false);
const aiTestResult = ref(null);
const locating = ref(false);
const detectedIP = ref('');
const gpsCoords = ref('');

const stepNames = ['基础信息', '棚区配置', '作物品种', '栽培条件', '历史问题', 'AI配置'];

const cities = [
  '北京', '上海', '广州', '深圳', '天津', '重庆',
  '石家庄', '太原', '呼和浩特', '沈阳', '长春', '哈尔滨',
  '南京', '杭州', '合肥', '福州', '南昌', '济南',
  '郑州', '武汉', '长沙', '南宁', '海口', '成都',
  '贵阳', '昆明', '拉萨', '西安', '兰州', '西宁',
  '银川', '乌鲁木齐', '大连', '青岛', '宁波', '厦门',
  '寿光', '青州', '昌乐', '莘县'
];

const allCropTypes = ['番茄', '黄瓜', '辣椒', '茄子', '甜椒', '生菜', '芹菜', '南瓜', '西葫芦', '苦瓜', '甜瓜', '西瓜', '豇豆', '草莓'];

const diseaseOptions = ['早疫', '晚疫', '灰霉', '霜霉', '白粉', '病毒', '蚜虫', '白粉虱', '无'];
const lossOptions = ['病害', '冻害', '高温', '产量不足', '品质差', '无'];
const problemOptions = ['减少用药', '提高产量', '省人工', '省水省肥', '品质提升'];

// Taxonomy families
const familyMap = {
  '番茄': '茄科', '辣椒': '茄科', '茄子': '茄科', '甜椒': '茄科',
  '黄瓜': '葫芦科', '南瓜': '葫芦科', '西葫芦': '葫芦科', '苦瓜': '葫芦科', '甜瓜': '葫芦科', '西瓜': '葫芦科',
  '豇豆': '豆科', '四季豆': '豆科', '荷兰豆': '豆科',
  '生菜': '叶菜类', '油菜': '叶菜类', '菠菜': '叶菜类', '芹菜': '叶菜类',
  '萝卜': '根茎类', '胡萝卜': '根茎类', '土豆': '根茎类',
  '大蒜': '葱蒜类', '洋葱': '葱蒜类', '韭菜': '葱蒜类',
  '草莓': '草莓'
};

// Varieties cache (reactive so selects re-render when data arrives)
import { reactive as vueReactive } from 'vue';
const varietiesCache = vueReactive({});

const form = reactive({
  cultivation_mode: '',
  city: '',
  city_source: null,
  lat: null,
  lon: null,
  scale: '',
  greenhouses: [createGreenhouse()],
  crops: [createCrop()],
  cultivation_method: '土壤栽培',
  soil: { soil_type: '壤土', ph: '适中(6.0-7.0)', organic: '中', amendment: '未改良' },
  substrate: { type: '椰糠', years: '第1年', spec: '标准袋(1m)' },
  water_fertilizer: { enabled: '是', method: '随水滴灌', water_source: '井水', water_quality: '良好' },
  equipment_mode: 'manual',
  equipment: {
    temp: '无', vent: '无', light: '无', co2: '无', monitor: '无'
  },
  history: { prev_crop_name: '', diseases: [], max_loss: '', problems: [] },
  ai: { enabled: false, api_base: '', api_key: '', model: '' }
});

function createGreenhouse() {
  return { id: 'gh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: '', area: 500, type: '日光温室', orientation: '东西走向', cover_material: 'PO膜', insulation: '好（有加温设备）', ventilation: '自然通风', irrigation: '滴灌', heating: '无', shading: '无', insect_net: '无' };
}

function createCrop() {
  return { id: 'crop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), greenhouse_id: '', crop_type: '', custom_name: '', variety_name: '', planting_date: '', current_stage: '', quantity: 1000, seed_source: '国产品种', nursery_method: '自育苗', seedling_age: 15, grafted: '否', prev_crop: '', target_yield: 0, stage_detail: {}, rotation_hint: '', rotation_ok: true };
}

function addGreenhouse() { form.greenhouses.push(createGreenhouse()); }
function addCrop() { form.crops.push(createCrop()); }

function stepValue(obj, key, delta, min, max) {
  const current = obj[key] || 0;
  const next = Math.max(min, Math.min(max, current + delta));
  obj[key] = next;
}



function onCropTypeChange(crop) {
  crop.variety_name = '';
  crop.stage_detail = {};
  if (crop.crop_type && crop.crop_type !== '其他') {
    loadVarieties(crop.crop_type);
    loadStageDetails(crop.crop_type);
  }
}

function getVarieties(cropType) {
  if (!cropType || cropType === '其他') return [];
  if (varietiesCache[cropType]) return varietiesCache[cropType];
  // Will be fetched from backend
  return [];
}

async function loadVarieties(cropType) {
  try {
    const res = await axios.get(`/api/knowledge/varieties/${cropType}`);
    varietiesCache[cropType] = res.data;
  } catch (e) {
    varietiesCache[cropType] = [];
  }
}

function getStages(cropType) {
  const predefined = {
    '番茄': ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'],
    '黄瓜': ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'],
    '辣椒': ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期']
  };
  return predefined[cropType] || ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
}

// Stage detail fields from knowledge (reactive)
const stageDetailCache = vueReactive({});
function getStageDetailFields(cropType, stageName) {
  const cacheKey = `${cropType}_${stageName}`;
  if (stageDetailCache[cacheKey]) return stageDetailCache[cacheKey];
  // Will be loaded from knowledge
  return [];
}

async function loadStageDetails(cropType) {
  try {
    const res = await axios.get(`/api/knowledge/crops/${cropType}`);
    const cropData = res.data;
    if (cropData?.stages) {
      for (const stage of cropData.stages) {
        stageDetailCache[`${cropType}_${stage.name}`] = stage.detail_fields || [];
      }
    }
  } catch (e) {
    // Failed to load, will use empty arrays
  }
}

function onStageChange(crop) {
  crop.stage_detail = {};
  if (crop.crop_type && crop.current_stage) {
    const fields = getStageDetailFields(crop.crop_type, crop.current_stage);
    for (const field of fields) {
      if (field.type === 'stepper') {
        crop.stage_detail[field.name] = field.min || 0;
      }
    }
  }
}

function checkRotation(crop) {
  if (!crop.prev_crop || crop.prev_crop === '首次种植') {
    crop.rotation_hint = crop.prev_crop === '首次种植' ? '首次种植，无轮作风险' : '';
    crop.rotation_ok = true;
    return;
  }
  const prevFamily = familyMap[crop.prev_crop] || '';
  const currFamily = familyMap[crop.crop_type] || '';
  if (!prevFamily || !currFamily) {
    crop.rotation_hint = '';
    return;
  }
  if (prevFamily === currFamily) {
    crop.rotation_hint = `上茬${crop.prev_crop}属${prevFamily}，当前${crop.crop_type}属${currFamily}，同科连作风险较高，建议加强土壤消毒`;
    crop.rotation_ok = false;
  } else {
    crop.rotation_hint = `上茬${crop.prev_crop}属${prevFamily}，当前${crop.crop_type}属${currFamily}，轮作合理`;
    crop.rotation_ok = true;
  }
}

async function detectLocation() {
  locating.value = true;
  form.city_source = '定位中...';
  detectedIP.value = '';
  gpsCoords.value = '';

  // Step 1: Try IP-based location via backend proxy
  let gotCoords = false;
  let gotCity = false;
  try {
    const res = await axios.get('/api/config/locate', { timeout: 10000 });
    if (res.data?.success && res.data?.lat) {
      form.lat = res.data.lat;
      form.lon = res.data.lon;
      detectedIP.value = res.data.ip || '';
      gotCoords = true;
      if (res.data.city) {
        form.city = res.data.city;
        form.city_source = res.data.source || 'IP定位';
        gotCity = true;
      }
    }
  } catch (e) {
    // IP定位失败，继续尝试GPS
  }

  // Step 2: If IP didn't get a city name, try browser GPS
  if (!gotCity && navigator.geolocation) {
    form.city_source = 'GPS定位中...';
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000, enableHighAccuracy: false
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      form.lat = lat;
      form.lon = lon;
      gpsCoords.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      gotCoords = true;

      // Try reverse geocoding to get city name
      try {
        const geoRes = await axios.get('/api/config/reverse-geocode', {
          params: { lat, lon }, timeout: 10000
        });
        if (geoRes.data?.success && geoRes.data?.city) {
          form.city = geoRes.data.city;
          form.city_source = `GPS (${geoRes.data.city})`;
          gotCity = true;
        }
      } catch (e) {
        // 反向编码服务不可用
      }
    } catch (e) {
      // GPS定位失败
    }
  }

  if (gotCoords && !gpsCoords.value && form.lat && form.lon) {
    gpsCoords.value = `${Number(form.lat).toFixed(4)}, ${Number(form.lon).toFixed(4)}`;
  }

  // Step 3: Ensure city field is always populated when we have coordinates
  if (gotCoords && !gotCity) {
    // 有坐标但无法解析城市名，使用坐标作为标识
    const latStr = form.lat.toFixed(2);
    const lonStr = form.lon.toFixed(2);
    form.city = `当前位置 (${latStr}, ${lonStr})`;
    form.city_source = `坐标定位 (${latStr}, ${lonStr})`;
  }

  // Show result toast
  if (gotCity) {
    if (window.__modal) window.__modal.showToast(`已定位到：${form.city}`, 'success');
  } else if (gotCoords) {
    if (window.__modal) window.__modal.showToast(`定位成功，天气数据可用`, 'success');
  } else {
    form.city_source = '定位失败，请手动输入城市';
    if (window.__modal) window.__modal.showToast('自动定位失败，请手动输入城市', 'error');
  }

  locating.value = false;
}

function validateStep(s) {
  error.value = '';
  let msg = '';
  if (s === 1) {
    if (!form.cultivation_mode) msg = '请选择种植模式';
    else if (!form.city) msg = '请选择所在城市';
    else if (!form.scale) msg = '请选择种植规模';
  }
  if (s === 2) {
    for (const gh of form.greenhouses) {
      if (!gh.name) { msg = '请填写棚区名称'; break; }
      if (gh.name.length > 8) { msg = '棚区名称最多8个字'; break; }
    }
  }
  if (s === 3) {
    for (const crop of form.crops) {
      if (!crop.greenhouse_id) { msg = '请选择作物所属棚区'; break; }
      if (!crop.crop_type) { msg = '请选择作物类型'; break; }
      if (!crop.planting_date) { msg = '请选择定植日期'; break; }
      if (!crop.current_stage) { msg = '请选择当前生长阶段'; break; }
    }
  }
  if (msg) {
    error.value = msg;
    if (window.__modal) window.__modal.showToast(msg, 'error');
    return false;
  }
  return true;
}

function nextStep() {
  if (!validateStep(step.value)) return;
  step.value++;
  // Load varieties and stage details when entering step 3
  if (step.value === 3) {
    for (const crop of form.crops) {
      if (crop.crop_type) {
        loadVarieties(crop.crop_type);
        loadStageDetails(crop.crop_type);
      }
    }
  }
}

function prevStep() { step.value--; error.value = ''; }

function skipStep5() { step.value = 6; }

function confirmFinish() {
  if (!validateStep(step.value)) return;
  showConfirm.value = true;
}

async function testAI() {
  aiTesting.value = true;
  aiTestResult.value = null;
  try {
    const res = await axios.post('/api/ai/test', form.ai);
    aiTestResult.value = res.data;
    // Auto-save AI config on successful test
    if (res.data?.success) {
      try {
        const currentConfig = (await axios.get('/api/config')).data || {};
        currentConfig.ai = { ...currentConfig.ai, ...form.ai };
        await axios.put('/api/config', currentConfig);
      } catch {}
    }
  } catch (err) {
    aiTestResult.value = { error: err.response?.data?.error || err.message };
  } finally {
    aiTesting.value = false;
  }
}

async function submitInit() {
  showConfirm.value = false;
  error.value = '';
  submitting.value = true;
  try {
    const payload = {
      cultivation_mode: form.cultivation_mode,
      city: form.city,
      city_source: form.city_source,
      lat: form.lat,
      lon: form.lon,
      scale: form.scale,
      greenhouses: form.greenhouses,
      crops: form.crops.map(c => ({
        ...c,
        type: c.crop_type === '其他' ? c.custom_name : c.crop_type,
        name: c.crop_type === '其他' ? c.custom_name : c.crop_type
      })),
      cultivation_method: form.cultivation_method,
      soil: form.cultivation_method === '土壤栽培' ? form.soil : null,
      substrate: form.cultivation_method === '基质栽培' ? form.substrate : null,
      water_fertilizer: form.water_fertilizer,
      equipment: { mode: form.equipment_mode, ...form.equipment },
      history: { ...form.history },
      ai: form.ai
    };
    await axios.post('/api/init', payload, { timeout: 15000 });
    await store.fetchConfig();
    submitting.value = false;
    if (window.__modal) {
      await window.__modal.showAlert('配置已保存，即将进入系统', '初始化成功');
    }
    router.push('/');
  } catch (err) {
    submitting.value = false;
    const msg = err.code === 'ECONNABORTED'
      ? '服务器响应超时，请确认后端服务已启动'
      : err.message === 'Network Error'
      ? '无法连接服务器，请确认后端服务已启动（端口3000）'
      : '初始化失败: ' + (err.response?.data?.error || err.message);
    if (window.__modal) {
      window.__modal.showAlert(msg, '初始化失败');
    } else {
      error.value = msg;
    }
  }
}

onMounted(async () => {
  // Pre-load varieties and stage details for predefined crops
  for (const ct of ['番茄', '黄瓜', '辣椒']) {
    loadVarieties(ct);
    loadStageDetails(ct);
  }
});
</script>

<style scoped>
.setup-wizard {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 80px;
}

.wizard-progress {
  margin-bottom: 24px;
}

.step-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.step-labels span.active { color: var(--primary); font-weight: 700; }
.step-labels span.done { color: var(--primary); }

.option-cards {
  display: flex;
  gap: 12px;
}

.option-card {
  flex: 1;
  padding: 20px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  text-align: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s;
}

.option-card.selected {
  border-color: var(--primary);
  background: rgba(45, 125, 70, 0.05);
  color: var(--primary);
}

.city-row {
  display: flex;
  gap: 8px;
}

.city-select { flex: 1; }
.btn-sm { padding: 8px 12px; font-size: 12px; }

.location-info { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.loc-item { font-size: 12px; color: var(--primary); background: rgba(45, 125, 70, 0.08); padding: 4px 10px; border-radius: 4px; }

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.greenhouse-card, .crop-card {
  position: relative;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 700;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
}

.btn-icon.danger { color: var(--danger); }

.full-width { width: 100%; }

.form-row {
  display: flex;
  gap: 12px;
}

.form-group.half { flex: 1; }

.searchable-select {
  position: relative;
}

.dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: var(--shadow-lg);
}

.dropdown-item {
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
}

.dropdown-item:active {
  background: rgba(45, 125, 70, 0.1);
}

.stage-detail {
  background: #f5f5f5;
  padding: 12px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.stage-detail h4 {
  margin-bottom: 12px;
  color: var(--primary);
}

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.radio-option {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}

.radio-option.selected {
  border-color: var(--primary);
  background: rgba(45, 125, 70, 0.05);
  color: var(--primary);
}

.radio-option input { display: none; }

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.checkbox-option {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
}

.checkbox-option.selected {
  border-color: var(--primary);
  background: rgba(45, 125, 70, 0.05);
  color: var(--primary);
}

.checkbox-option input { display: none; }

.sub-form {
  background: #f9f9f9;
  padding: 16px;
  border-radius: var(--radius-sm);
  margin: 12px 0;
}

.sub-form h4 {
  margin-bottom: 12px;
  font-size: 14px;
}

.optional {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.rotation-hint {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.rotation-hint.ok {
  background: #e8f5e9;
  color: var(--success);
}

.rotation-hint.warn {
  background: #fff3e0;
  color: var(--accent);
}

.switch-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.switch {
  position: relative;
  width: 48px;
  height: 28px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #ccc;
  border-radius: 14px;
  transition: 0.3s;
}

.switch-slider::before {
  content: '';
  position: absolute;
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

.switch input:checked + .switch-slider {
  background: var(--primary);
}

.switch input:checked + .switch-slider::before {
  transform: translateX(20px);
}

.wizard-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 12px 16px;
  padding-bottom: calc(12px + var(--safe-bottom));
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  z-index: 100;
}

.wizard-nav .spacer { flex: 1; }

.confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.success { background: #e8f5e9; }
.error { background: #ffebee; }
</style>
