<template>
  <div class="page settings-page">
    <h2>设置</h2>

    <!-- AI Configuration -->
    <div class="card settings-card ai-card">
      <div class="ai-header" @click="sections.ai = !sections.ai">
        <div class="ai-header-left">
          <span class="ai-icon">🤖</span>
          <div>
            <h3 class="ai-title">AI 智能助手</h3>
            <p class="ai-subtitle">配置AI接口，获取智能分析建议</p>
          </div>
        </div>
        <div class="ai-header-right">
          <span class="ai-status" :class="configData.ai.enabled ? 'active' : 'inactive'">
            {{ configData.ai.enabled ? '已启用' : '未启用' }}
          </span>
          <span class="ai-arrow" :class="{ expanded: sections.ai }">▾</span>
        </div>
      </div>
      
      <div v-if="sections.ai" class="ai-content">
        <!-- Enable Switch -->
        <div class="ai-enable-row">
          <div class="ai-enable-info">
            <span class="ai-enable-label">启用 AI 功能</span>
            <span class="ai-enable-desc">开启后可使用智能分析和种植计划</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="configData.ai.enabled" @change="saveConfig" />
            <span class="switch-slider"></span>
          </label>
        </div>

        <div v-if="configData.ai.enabled" class="ai-config-section">
          <!-- API Configuration -->
          <div class="ai-config-group">
            <div class="ai-config-header">
              <span class="ai-config-icon">🔗</span>
              <span class="ai-config-title">接口配置</span>
            </div>
            
            <div class="ai-form-grid">
              <div class="ai-form-item full">
                <label class="ai-label">接口地址</label>
                <div class="ai-input-wrapper">
                  <input v-model="configData.ai.api_base" class="ai-input" placeholder="https://api.openai.com/v1" @blur="saveConfig" />
                  <span class="ai-input-hint">OpenAI 兼容接口</span>
                </div>
              </div>
              
              <div class="ai-form-item">
                <label class="ai-label">API 密钥</label>
                <div class="ai-input-wrapper">
                  <input v-model="configData.ai.api_key" class="ai-input" :type="showKey ? 'text' : 'password'" @blur="saveConfig" placeholder="sk-..." />
                  <button class="ai-key-toggle" @click="showKey = !showKey">
                    {{ showKey ? '🙈' : '👁' }}
                  </button>
                </div>
              </div>
              
              <div class="ai-form-item">
                <label class="ai-label">模型名称</label>
                <div class="ai-input-wrapper model-select-wrapper">
                  <input v-model="configData.ai.model" class="ai-input model-input" @blur="saveConfig" placeholder="gpt-4o-mini" />
                  <button class="model-fetch-btn" @click="fetchModels" :disabled="modelsLoading" :title="models.length ? '刷新模型列表' : '获取模型列表'">
                    <span v-if="modelsLoading" class="model-fetch-loading">⟳</span>
                    <span v-else class="model-fetch-arrow">▾</span>
                  </button>
                  <div v-if="showModelDropdown && models.length" class="model-dropdown">
                    <div class="model-dropdown-header">
                      <span>可用模型 ({{ models.length }})</span>
                      <button class="model-dropdown-close" @click="showModelDropdown = false">✕</button>
                    </div>
                    <div class="model-dropdown-list">
                      <div 
                        v-for="m in models" 
                        :key="m" 
                        class="model-dropdown-item"
                        :class="{ active: configData.ai.model === m }"
                        @mousedown.prevent="selectModel(m)"
                      >
                        {{ m }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="ai-action-row">
            <button class="ai-action-btn test-btn" @click="testAI" :disabled="aiTesting">
              <span v-if="aiTesting" class="btn-loading">⟳</span>
              <span v-else>⚡ 测试连接</span>
            </button>
            <button class="ai-action-btn analyze-btn" @click="runAnalysis" :disabled="aiAnalyzing || analysisCooldown > 0">
              <span v-if="aiAnalyzing" class="btn-loading">⟳</span>
              <span v-else>🧠 {{ analysisCooldown > 0 ? `${analysisCooldown}s` : '智能分析' }}</span>
            </button>
          </div>

          <!-- Test Result -->
          <div v-if="aiResult" class="ai-mini-result" :class="aiResult.success ? 'success' : 'error'">
            <span>{{ aiResult.success ? `✓ ${aiResult.model} (${aiResult.responseTime}ms)` : `✗ ${aiResult.error}` }}</span>
          </div>

          <!-- Analysis Result -->
          <div v-if="analysisResult" class="ai-analysis-box">
            <template v-if="analysisResult.crop_analyses?.length">
              <div v-for="(item, idx) in analysisResult.crop_analyses" :key="idx" class="analysis-item">
                <span class="analysis-tag" :class="getPriorityClass(item.operation_advice?.priority)">{{ item.operation_advice?.priority || '中' }}</span>
                <span>{{ getCropIcon(item.crop_type) }} {{ item.greenhouse_name }} · {{ item.crop_type }} {{ item.variety_name }}：{{ item.operation_advice?.summary }}</span>
              </div>
            </template>
            <template v-else>
              <div class="analysis-item" v-if="analysisResult.operation_advice">
                <span class="analysis-tag" :class="getPriorityClass(analysisResult.operation_advice.priority)">{{ analysisResult.operation_advice.priority }}</span>
                <span>{{ analysisResult.operation_advice.summary }}</span>
              </div>
              <div class="analysis-item warning" v-if="analysisResult.risk_warning?.summary">
                <span class="analysis-tag warn">⚠ 风险</span>
                <span>{{ analysisResult.risk_warning.summary }}</span>
              </div>
            </template>
          </div>

          <!-- Usage Stats (Compact Inline) -->
          <div v-if="aiUsage" class="ai-stats-inline">
            <span><b>{{ aiUsage.total_analyze_month || 0 }}</b> 分析</span>
            <span><b>{{ aiUsage.total_plan_month || 0 }}</b> 计划</span>
            <span><b>{{ Math.round((aiUsage.estimated_tokens || 0) / 1000) }}k</b> Token</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Weather Sources -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.weather = !sections.weather">天气源状态 ▾</h3>
      <div v-if="sections.weather">
        <div v-if="weather?.sources?.status">
          <div v-for="(status, name) in weather.sources.status" :key="name" class="source-row">
            <span class="source-name">{{ sourceNames[name] || name }}</span>
            <span class="source-location" v-if="getSourceLocation(name)">{{ getSourceLocation(name) }}</span>
            <span class="badge" :class="status ? 'badge-online' : 'badge-offline'">{{ status ? '在线' : '离线' }}</span>
          </div>
        </div>
        <div v-else class="empty">天气数据暂不可用</div>
      </div>
    </div>

    <!-- City -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.city = !sections.city">所在城市 ▾</h3>
      <div v-if="sections.city">
        <div class="form-group">
          <div class="city-container">
            <div class="city-main-row">
              <div class="city-input-group">
                <label class="city-label">城市/位置</label>
                <select v-model="configData.city" class="form-select city-select" :disabled="configData.city === '__manual__'">
                  <option value="">选择城市...</option>
                  <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <button class="btn btn-coord" :class="{ active: configData.city === '__manual__' }" @click="toggleManualInput">
                {{ configData.city === '__manual__' ? '✕ 取消' : '📍 坐标' }}
              </button>
            </div>
            
            <div class="city-coords-row" v-if="configData.city === '__manual__' || manualCoords">
              <div class="coords-input-group">
                <label class="coords-label">坐标 (纬度, 经度)</label>
                <input 
                  v-model="manualCoords" 
                  class="form-input coords-input" 
                  placeholder="例: 39.9042, 116.4074"
                  @input="validateCoords"
                  :class="{ 'input-error': coordsError }"
                />
                <span v-if="coordsError" class="error-hint">{{ coordsError }}</span>
              </div>
            </div>

            <div class="city-actions-row">
              <button class="btn btn-outline btn-sm" @click="detectLocation" :disabled="locating">{{ locating ? '定位中...' : '自动定位' }}</button>
              <button class="btn btn-primary btn-sm" @click="applyCitySettings" :disabled="!canApplyCity">应用</button>
              <span class="loc-item">源：{{ configData.city_source || '未设置' }}</span>
              <span class="loc-item" v-if="gpsCoords">GPS：{{ gpsCoords }}</span>
              <span class="loc-item" v-if="detectedIP">IP：{{ detectedIP }}</span>
              <span class="loc-item loc-pending" v-if="hasUnsavedChanges">⚠️ 未保存</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Greenhouse Management -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.greenhouses = !sections.greenhouses">棚区管理 ▾</h3>
      <div v-if="sections.greenhouses">
        <div v-for="gh in configData.greenhouses || []" :key="gh.id" class="list-item">
          <span>{{ gh.name }} ({{ gh.area }}m²)</span>
          <button class="btn-icon danger" @click="deleteGreenhouse(gh.id)">删除</button>
        </div>
        <div v-if="!configData.greenhouses?.length" class="empty">暂无棚区</div>

        <button v-if="!showAddGreenhouse" class="btn btn-outline full-width" style="margin-top:12px" @click="showAddGreenhouse = true">+ 添加棚区</button>

        <div v-if="showAddGreenhouse" class="add-form-card card" style="margin-top:12px;background:var(--bg)">
          <div class="card-header">
            <span>新增棚区</span>
            <button class="btn-icon" @click="showAddGreenhouse = false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">棚区名称 <span class="required">*</span></label>
            <input v-model="newGreenhouse.name" class="form-input" maxlength="8" placeholder="最多8个字" />
          </div>
          <div class="form-group">
            <label class="form-label">面积 (m²)</label>
            <input v-model.number="newGreenhouse.area" type="number" class="form-input" min="100" max="5000" placeholder="100-5000" />
          </div>
          <div class="form-group">
            <label class="form-label">棚型</label>
            <select v-model="newGreenhouse.type" class="form-select">
              <option v-for="t in ['日光温室', '大拱棚', '连栋温室', '简易棚']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">棚体朝向</label>
            <select v-model="newGreenhouse.orientation" class="form-select">
              <option v-for="t in ['东西走向', '南北走向']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">覆盖材料</label>
            <select v-model="newGreenhouse.cover_material" class="form-select">
              <option v-for="t in ['PO膜', 'PE膜', '玻璃', 'PC板']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">保温能力</label>
            <select v-model="newGreenhouse.insulation" class="form-select">
              <option value="好（有加温设备）">好（有加温设备）</option>
              <option value="一般">一般</option>
              <option value="差">差</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">通风方式</label>
            <select v-model="newGreenhouse.ventilation" class="form-select">
              <option v-for="t in ['自然通风', '机械通风', '两者结合']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">灌溉方式</label>
            <select v-model="newGreenhouse.irrigation" class="form-select">
              <option v-for="t in ['滴灌', '喷灌', '沟灌', '人工浇灌']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group half">
              <label class="form-label">加温设备</label>
              <select v-model="newGreenhouse.heating" class="form-select">
                <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="form-group half">
              <label class="form-label">遮阳设备</label>
              <select v-model="newGreenhouse.shading" class="form-select">
                <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">防虫网</label>
            <select v-model="newGreenhouse.insect_net" class="form-select">
              <option v-for="t in ['有', '无']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <button class="btn btn-primary full-width" @click="submitNewGreenhouse">保存棚区</button>
        </div>
      </div>
    </div>

    <!-- Crop Management -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.crops = !sections.crops">作物管理 ▾</h3>
      <div v-if="sections.crops">
        <div v-for="crop in configData.crops || []" :key="crop.id" class="list-item">
          <div>
            <span>{{ crop.type }} {{ crop.variety_name }} - {{ crop.greenhouse_name }}</span>
            <span class="badge">{{ crop.current_stage }}</span>
          </div>
          <button class="btn-icon" @click="editCropStage(crop)">修改阶段</button>
        </div>
        <div v-if="!configData.crops?.length" class="empty">暂无作物</div>

        <button v-if="!showAddCrop" class="btn btn-outline full-width" style="margin-top:12px" @click="openAddCropForm">+ 添加作物</button>

        <div v-if="showAddCrop" class="add-form-card card" style="margin-top:12px;background:var(--bg)">
          <div class="card-header">
            <span>新增作物</span>
            <button class="btn-icon" @click="showAddCrop = false">✕</button>
          </div>
          <div class="form-group">
            <label class="form-label">所属棚区 <span class="required">*</span></label>
            <select v-model="newCrop.greenhouse_id" class="form-select">
              <option value="">请选择棚区</option>
              <option v-for="gh in configData.greenhouses || []" :key="gh.id" :value="gh.id">{{ gh.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">作物类型 <span class="required">*</span></label>
            <select v-model="newCrop.crop_type" class="form-select" @change="onNewCropTypeChange">
              <option value="">请选择作物类型</option>
              <option v-for="ct in addCropTypes" :key="ct" :value="ct">{{ ct }}</option>
              <option value="其他">其他（自定义）</option>
            </select>
          </div>
          <div v-if="newCrop.crop_type === '其他'" class="form-group">
            <label class="form-label">自定义作物名称</label>
            <input v-model="newCrop.custom_name" class="form-input" maxlength="8" placeholder="最多8个字" />
          </div>
          <div class="form-group">
            <label class="form-label">品种名称</label>
            <select v-model="newCrop.variety_name" class="form-select">
              <option value="">请选择品种</option>
              <option v-for="v in addCropVarieties" :key="v.name" :value="v.name">{{ v.name }}</option>
              <option value="其他">其他</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">定植日期 <span class="required">*</span></label>
            <input type="date" v-model="newCrop.planting_date" class="form-input" />
          </div>
          <div class="form-group">
            <label class="form-label">当前生长阶段 <span class="required">*</span></label>
            <select v-model="newCrop.current_stage" class="form-select" @change="onNewStageChange">
              <option v-for="s in addCropStages" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div v-if="newCrop.current_stage && addStageDetailFields.length > 0" class="stage-detail">
            <h4>{{ newCrop.current_stage }}详情</h4>
            <div v-for="field in addStageDetailFields" :key="field.name" class="form-group">
              <label class="form-label">{{ field.name }}{{ field.unit ? ` (${field.unit})` : '' }}</label>
              <div v-if="field.type === 'stepper'" class="stepper">
                <button class="stepper-btn" @click="stepNewCropDetail(field.name, -(field.step || 1), field.min || 0, field.max || 9999)">-</button>
                <span class="stepper-value">{{ newCrop.stage_detail[field.name] ?? field.min ?? 0 }}</span>
                <button class="stepper-btn" @click="stepNewCropDetail(field.name, field.step || 1, field.min || 0, field.max || 9999)">+</button>
              </div>
              <select v-else-if="field.type === 'select'" v-model="newCrop.stage_detail[field.name]" class="form-select">
                <option value="">请选择</option>
                <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">种植数量 (株)</label>
            <div class="stepper">
              <button class="stepper-btn" @click="stepNewCrop('quantity', -100, 100, 50000)">-</button>
              <span class="stepper-value">{{ newCrop.quantity }}</span>
              <button class="stepper-btn" @click="stepNewCrop('quantity', 100, 100, 50000)">+</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">种子来源</label>
            <select v-model="newCrop.seed_source" class="form-select">
              <option v-for="t in ['国产品种', '进口品种', '自留种']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">育苗方式</label>
            <select v-model="newCrop.nursery_method" class="form-select">
              <option v-for="t in ['自育苗', '外购苗']" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div v-if="newCrop.nursery_method === '外购苗'" class="form-group">
            <label class="form-label">苗龄 (天)</label>
            <div class="stepper">
              <button class="stepper-btn" @click="stepNewCrop('seedling_age', -1, 1, 90)">-</button>
              <span class="stepper-value">{{ newCrop.seedling_age || 15 }}</span>
              <button class="stepper-btn" @click="stepNewCrop('seedling_age', 1, 1, 90)">+</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">是否嫁接</label>
            <div class="radio-group">
              <label v-for="t in ['是', '否']" :key="t" class="radio-option" :class="{ selected: newCrop.grafted === t }">
                <input type="radio" v-model="newCrop.grafted" :value="t" /> {{ t }}
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">上茬作物</label>
            <select v-model="newCrop.prev_crop" class="form-select" @change="checkNewCropRotation">
              <option value="">请选择</option>
              <option v-for="ct in addCropTypes" :key="ct" :value="ct">{{ ct }}</option>
              <option value="首次种植">首次种植</option>
            </select>
            <div v-if="newCrop.rotation_hint" class="rotation-hint" :class="newCrop.rotation_ok ? 'ok' : 'warn'">
              {{ newCrop.rotation_hint }}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">目标产量 (斤/亩) <span class="optional">可选</span></label>
            <div class="stepper">
              <button class="stepper-btn" @click="stepNewCrop('target_yield', -100, 0, 99999)">-</button>
              <span class="stepper-value">{{ newCrop.target_yield || '未设置' }}</span>
              <button class="stepper-btn" @click="stepNewCrop('target_yield', 100, 0, 99999)">+</button>
            </div>
          </div>
          <button class="btn btn-primary full-width" @click="submitNewCrop">保存作物</button>
        </div>
      </div>
    </div>




    <!-- Template Management -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.templates = !sections.templates">模板管理 ▾</h3>
      <div v-if="sections.templates">
        <div v-for="tpl in templates" :key="tpl.id" class="list-item">
          <span>{{ tpl.name }} ({{ tpl.type }})</span>
          <button class="btn-icon danger" @click="deleteTemplate(tpl.id)">删除</button>
        </div>
        <div v-if="!templates?.length" class="empty">暂无操作模板</div>
      </div>
    </div>


    <!-- Data Management -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.data = !sections.data">数据管理 ▾</h3>
      <div v-if="sections.data">
        <button class="btn btn-outline full-width" @click="exportData">导出全部数据记录</button>
        <button class="btn btn-outline full-width" style="margin-top:8px" @click="exportOps">导出全部操作记录</button>
        <button class="btn btn-outline full-width danger-btn" style="margin-top:16px" @click="reinit">重新初始化</button>
      </div>
    </div>

    <!-- Help Section -->
    <div class="card settings-card">
      <h3 class="card-title" @click="sections.help = !sections.help">帮助与介绍 ▾</h3>
      <div v-if="sections.help" class="help-content">
        <div class="help-section">
          <h4>🌿 农事专家</h4>
          <p>智能设施蔬菜种植决策系统，为大棚蔬菜种植提供全方位的数字化管理支持。</p>
        </div>
        <div class="help-section">
          <h4>📱 主要功能</h4>
          <div class="help-item"><span class="help-icon">🏠</span><div><b>首页</b><br>实时天气、作物生长状态、AI智能建议、风险预警</div></div>
          <div class="help-item"><span class="help-icon">🌱</span><div><b>种植计划</b><br>AI生成种植计划，关键农事提醒，采收预测</div></div>
          <div class="help-item"><span class="help-icon">📝</span><div><b>操作记录</b><br>记录施肥、浇水、打药等农事操作，支持模板快速录入</div></div>
          <div class="help-item"><span class="help-icon">📊</span><div><b>数据记录</b><br>株高、叶片数、产量等生长数据追踪，支持图表分析和导出</div></div>
          <div class="help-item"><span class="help-icon">📚</span><div><b>知识库</b><br>作物栽培技术、病虫害防治、农药安全、品种信息</div></div>
          <div class="help-item"><span class="help-icon">⚙️</span><div><b>设置</b><br>棚区管理、作物管理、AI配置、天气源、数据导出</div></div>
        </div>
        <div class="help-section">
          <h4>🤖 AI 功能</h4>
          <p>配置 OpenAI 兼容接口后，可使用智能分析和种植计划生成。支持自定义接口地址和模型。</p>
        </div>
        <div class="help-section">
          <h4>💡 使用提示</h4>
          <ul class="help-tips">
            <li>首次使用请完成初始化向导，配置棚区和作物信息</li>
            <li>定期记录农事操作，便于追溯和分析</li>
            <li>关注首页天气预警和AI建议，及时调整管理措施</li>
            <li>可在设置中随时添加新的棚区和作物</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- About Section -->
    <div class="card settings-card about-section">
      <div class="about-info" @click="onVersionTap">
        <div class="app-name">农事专家</div>
        <div class="app-version">v1.0.0</div>
        <div class="app-desc">智能设施蔬菜种植决策系统</div>
      </div>
    </div>

    <!-- Developer Options Modal -->
    <div v-if="showDevOptions" class="dev-modal-overlay" @click.self="showDevOptions = false">
      <div class="dev-modal-container">
        <div class="dev-modal-header-bar">
          <h3>🛠️ 开发者选项</h3>
          <div class="dev-notice">⚠ 以下功能仅限开发者使用</div>
          <button class="dev-modal-close" @click="showDevOptions = false">✕</button>
        </div>
        <div class="dev-modal-body">
      
      <!-- Tab Navigation -->
      <div class="dev-tabs">
        <button 
          v-for="tab in devTabs" 
          :key="tab.id"
          class="dev-tab"
          :class="{ active: activeDevTab === tab.id }"
          @click="activeDevTab = tab.id"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>
      
      <!-- Add Knowledge Tab -->
      <div v-if="activeDevTab === 'add'" class="dev-tab-content">
        <h4>添加知识</h4>
        <div class="dev-info">用户补充知识：填写中文表单，自动生成系统格式</div>
        
        <div class="form-group">
          <label class="form-label">知识类型</label>
          <select v-model="devForm.type" class="form-select" @change="onTypeChange">
            <option value="crops">作物知识</option>
            <option value="diseases">病虫害</option>
            <option value="pesticides">农药</option>
            <option value="varieties">品种库</option>
            <option value="decision_rules">决策规则</option>
          </select>
        </div>
        
        <!-- Crops Form -->
        <div v-if="devForm.type === 'crops'" class="dev-form-section">
          <div class="dev-form-header">基本信息</div>
          <div class="form-group">
            <label class="form-label">作物名称 <span class="required">*</span></label>
            <div class="select-with-custom">
              <select v-model="devForm.crops.name" class="form-select" @change="onCropNameChange">
                <option value="">请选择或自定义</option>
                <option v-for="c in existingCrops" :key="c" :value="c">{{ c }}</option>
                <option value="__custom__">自定义...</option>
              </select>
              <input 
                v-if="devForm.crops.name === '__custom__' || isCustomCropName" 
                v-model="devForm.crops.customName" 
                class="form-input" 
                placeholder="输入作物名称（最多6字符）"
                maxlength="6"
                @input="onCustomCropNameInput"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">所属科 <span class="required">*</span></label>
            <input v-model="devForm.crops.family" class="form-input" placeholder="如：茄科" />
          </div>
          <div class="form-group">
            <label class="form-label">学名</label>
            <input v-model="devForm.crops.latin_name" class="form-input" placeholder="如：Solanum lycopersicum" />
          </div>
          <div class="form-group">
            <label class="form-label">全生育期（天）</label>
            <input v-model.number="devForm.crops.total_days" type="number" class="form-input" placeholder="150" />
          </div>
          
          <div class="dev-form-header">生长阶段</div>
          <div v-for="(stage, idx) in devForm.crops.stages" :key="idx" class="dev-stage-card">
            <div class="dev-stage-header">
              <span>阶段 {{ idx + 1 }}</span>
              <button class="btn-icon danger" @click="devForm.crops.stages.splice(idx, 1)">删除</button>
            </div>
            <div class="form-group">
              <label class="form-label">阶段名称 <span class="required">*</span></label>
              <input v-model="stage.name" class="form-input" placeholder="如：育苗期" />
            </div>
            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">顺序</label>
                <input v-model.number="stage.order" type="number" class="form-input" :placeholder="idx + 1" />
              </div>
              <div class="form-group half">
                <label class="form-label">典型天数</label>
                <input v-model.number="stage.typical_days" type="number" class="form-input" placeholder="30" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">阶段描述</label>
              <input v-model="stage.description" class="form-input" placeholder="从播种到定植前" />
            </div>
            <div class="form-group">
              <label class="form-label">管理要点（每行一条）</label>
              <textarea v-model="stage.key_points_text" class="form-textarea" rows="3" placeholder="温度管理促壮苗&#10;适当控水蹲苗"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">白天温度</label>
              <input v-model="stage.temperature_day" class="form-input" placeholder="25-30°C" />
            </div>
            <div class="form-group">
              <label class="form-label">夜间温度</label>
              <input v-model="stage.temperature_night" class="form-input" placeholder="15-18°C" />
            </div>
            <div class="form-group">
              <label class="form-label">浇水要点</label>
              <input v-model="stage.watering" class="form-input" placeholder="控水蹲苗" />
            </div>
            <div class="form-group">
              <label class="form-label">施肥要点</label>
              <input v-model="stage.fertilization" class="form-input" placeholder="苗期轻施" />
            </div>
            <div class="form-group">
              <label class="form-label">监测病虫害（每行一条）</label>
              <textarea v-model="stage.pest_watch_text" class="form-textarea" rows="2" placeholder="猝倒病&#10;霜霉病"></textarea>
            </div>
          </div>
          <button class="btn btn-outline full-width" @click="addCropStage">+ 添加生长阶段</button>
          
          <div class="dev-form-header">病虫害列表</div>
          <div class="form-group">
            <label class="form-label">常见病虫害（每行一条）</label>
            <textarea v-model="devForm.crops.diseases_text" class="form-textarea" rows="3" placeholder="霜霉病&#10;白粉病&#10;蚜虫"></textarea>
          </div>
        </div>
        
        <!-- Diseases Form -->
        <div v-if="devForm.type === 'diseases'" class="dev-form-section">
          <div class="dev-form-header">基本信息</div>
          <div class="form-group">
            <label class="form-label">病虫害名称 <span class="required">*</span></label>
            <input v-model="devForm.diseases.name" class="form-input" placeholder="如：白粉虱" />
          </div>
          <div class="form-group">
            <label class="form-label">别名</label>
            <input v-model="devForm.diseases.alias" class="form-input" placeholder="如：烟粉虱" />
          </div>
          <div class="form-group">
            <label class="form-label">类型 <span class="required">*</span></label>
            <select v-model="devForm.diseases.pathogen_type" class="form-select">
              <option value="虫害">虫害</option>
              <option value="病害">病害</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">病原名称</label>
            <input v-model="devForm.diseases.pathogen_name" class="form-input" placeholder="如：温室白粉虱" />
          </div>
          <div class="form-group">
            <label class="form-label">危害作物 <span class="required">*</span>（选择第一个作物作为分类目录）</label>
            <select v-model="devForm.diseases.firstCrop" class="form-select">
              <option value="">请选择主要危害作物</option>
              <option v-for="c in existingCrops" :key="c" :value="c">{{ c }}</option>
              <option value="其他">其他</option>
            </select>
            <div class="form-hint">此字段决定病虫害保存到哪个作物目录下</div>
          </div>
          <div class="form-group">
            <label class="form-label">其他危害作物（每行一条，可选）</label>
            <textarea v-model="devForm.diseases.crops_text" class="form-textarea" rows="2" placeholder="黄瓜&#10;辣椒"></textarea>
          </div>
          
          <div class="dev-form-header">症状描述</div>
          <div class="form-group">
            <label class="form-label">叶片症状</label>
            <textarea v-model="devForm.diseases.symptoms_leaf" class="form-textarea" rows="2" placeholder="叶片褪绿变黄"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">茎秆症状</label>
            <textarea v-model="devForm.diseases.symptoms_stem" class="form-textarea" rows="2" placeholder="生长点萎缩"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">植株症状</label>
            <textarea v-model="devForm.diseases.symptoms_plant" class="form-textarea" rows="2" placeholder="分泌蜜露引发煤污病"></textarea>
          </div>
          
          <div class="dev-form-header">防治方法</div>
          <div class="form-group">
            <label class="form-label">农业防治（每行一条）</label>
            <textarea v-model="devForm.diseases.agricultural_control_text" class="form-textarea" rows="3" placeholder="清洁田园&#10;轮作倒茬"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">物理防治（每行一条）</label>
            <textarea v-model="devForm.diseases.physical_control_text" class="form-textarea" rows="3" placeholder="黄色粘虫板诱杀&#10;防虫网隔离"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">生物防治（每行一条）</label>
            <textarea v-model="devForm.diseases.biological_control_text" class="form-textarea" rows="3" placeholder="释放天敌&#10;使用微生物制剂"></textarea>
          </div>
        </div>
        
        <!-- Pesticides Form -->
        <div v-if="devForm.type === 'pesticides'" class="dev-form-section">
          <div class="dev-form-header">农药信息</div>
          <div class="form-group">
            <label class="form-label">农药名称 <span class="required">*</span></label>
            <input v-model="devForm.pesticides.name" class="form-input" placeholder="如：吡虫啉" />
          </div>
          <div class="form-group">
            <label class="form-label">农药类型 <span class="required">*</span></label>
            <select v-model="devForm.pesticides.type" class="form-select">
              <option value="杀虫剂">杀虫剂</option>
              <option value="杀菌剂">杀菌剂</option>
              <option value="除草剂">除草剂</option>
              <option value="植物生长调节剂">植物生长调节剂</option>
              <option value="生物农药">生物农药</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">有效成分</label>
            <input v-model="devForm.pesticides.active_ingredient" class="form-input" placeholder="吡虫啉" />
          </div>
          <div class="form-group">
            <label class="form-label">安全间隔期（天）</label>
            <input v-model.number="devForm.pesticides.safety_interval_days" type="number" class="form-input" placeholder="7" />
          </div>
          <div class="form-group">
            <label class="form-label">适用作物（每行一条）</label>
            <textarea v-model="devForm.pesticides.applicable_crops_text" class="form-textarea" rows="2" placeholder="番茄&#10;黄瓜&#10;辣椒"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">防治对象（每行一条）</label>
            <textarea v-model="devForm.pesticides.control_targets_text" class="form-textarea" rows="2" placeholder="蚜虫&#10;白粉虱"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">稀释倍数</label>
            <input v-model="devForm.pesticides.dilution" class="form-input" placeholder="2000倍" />
          </div>
          <div class="form-group">
            <label class="form-label">用量</label>
            <input v-model="devForm.pesticides.dosage" class="form-input" placeholder="10g/亩" />
          </div>
        </div>
        
        <!-- Varieties Form -->
        <div v-if="devForm.type === 'varieties'" class="dev-form-section">
          <div class="dev-form-header">品种信息</div>
          <div class="form-group">
            <label class="form-label">作物类型 <span class="required">*</span></label>
            <div class="select-with-custom">
              <select v-model="devForm.varieties.crop" class="form-select" @change="onVarietyCropChange">
                <option value="">请选择或自定义</option>
                <option v-for="c in existingCrops" :key="c" :value="c">{{ c }}</option>
                <option value="__custom__">自定义...</option>
              </select>
              <input 
                v-if="devForm.varieties.crop === '__custom__' || isCustomVarietyCrop" 
                v-model="devForm.varieties.customCrop" 
                class="form-input" 
                placeholder="输入作物类型（最多6字符）"
                maxlength="6"
                @input="onCustomVarietyCropInput"
              />
            </div>
          </div>
          <div class="dev-form-header">品种列表</div>
          <div v-for="(v, idx) in devForm.varieties.list" :key="idx" class="dev-stage-card">
            <div class="dev-stage-header">
              <span>品种 {{ idx + 1 }}</span>
              <button class="btn-icon danger" @click="devForm.varieties.list.splice(idx, 1)">删除</button>
            </div>
            <div class="form-group">
              <label class="form-label">品种名称 <span class="required">*</span></label>
              <input v-model="v.name" class="form-input" placeholder="如：粉贝娜" />
            </div>
            <div class="form-group">
              <label class="form-label">品种特性</label>
              <textarea v-model="v.characteristics_text" class="form-textarea" rows="2" placeholder="早熟、抗病性强"></textarea>
            </div>
          </div>
          <button class="btn btn-outline full-width" @click="addVariety">+ 添加品种</button>
        </div>
        
        <!-- Decision Rules Form -->
        <div v-if="devForm.type === 'decision_rules'" class="dev-form-section">
          <div class="dev-form-header">决策规则</div>
          <div class="form-group">
            <label class="form-label">规则名称 <span class="required">*</span></label>
            <input v-model="devForm.decision_rules.name" class="form-input" placeholder="如：温度过高预警" />
          </div>
          <div class="form-group">
            <label class="form-label">规则类型</label>
            <select v-model="devForm.decision_rules.rule_type" class="form-select">
              <option value="irrigation">灌溉规则</option>
              <option value="fertilization">施肥规则</option>
              <option value="ventilation">通风规则</option>
              <option value="emergency">紧急规则</option>
              <option value="pest_control">病虫害防治</option>
              <option value="custom">自定义规则</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">规则描述</label>
            <textarea v-model="devForm.decision_rules.description" class="form-textarea" rows="2" placeholder="描述这条规则的作用和触发条件"></textarea>
          </div>
          
          <div class="dev-form-header">触发条件</div>
          <div v-for="(cond, idx) in devForm.decision_rules.conditions" :key="idx" class="dev-condition-row">
            <select v-model="cond.metric" class="form-select condition-select">
              <option value="">选择指标</option>
              <option value="temperature">温度</option>
              <option value="humidity">湿度</option>
              <option value="soil_moisture">土壤湿度</option>
              <option value="light">光照</option>
              <option value="wind">风速</option>
              <option value="rain">降雨</option>
              <option value="growth_stage">生长阶段</option>
              <option value="pest_found">发现病虫害</option>
              <option value="custom">自定义</option>
            </select>
            <select v-model="cond.operator" class="form-select operator-select">
              <option value=">">大于</option>
              <option value="<">小于</option>
              <option value=">=">大于等于</option>
              <option value="<=">小于等于</option>
              <option value="==">等于</option>
              <option value="!=">不等于</option>
              <option value="contains">包含</option>
            </select>
            <input v-model="cond.value" class="form-input value-input" placeholder="值" />
            <button class="btn-icon danger" @click="devForm.decision_rules.conditions.splice(idx, 1)">✕</button>
          </div>
          <button class="btn btn-outline btn-sm" @click="addCondition">+ 添加条件</button>
          
          <div class="dev-form-header">执行动作</div>
          <div v-for="(action, idx) in devForm.decision_rules.actions" :key="idx" class="dev-action-row">
            <select v-model="action.type" class="form-select action-type-select">
              <option value="">选择动作</option>
              <option value="alert">发送预警</option>
              <option value="irrigation">启动灌溉</option>
              <option value="ventilation">开启通风</option>
              <option value="fertilization">施肥提醒</option>
              <option value="pesticide">施药提醒</option>
              <option value="record">记录日志</option>
              <option value="custom">自定义</option>
            </select>
            <input v-model="action.message" class="form-input action-msg-input" placeholder="动作说明或消息内容" />
            <button class="btn-icon danger" @click="devForm.decision_rules.actions.splice(idx, 1)">✕</button>
          </div>
          <button class="btn btn-outline btn-sm" @click="addRuleAction">+ 添加动作</button>
          
          <div class="dev-form-header">优先级设置</div>
          <div class="form-group">
            <label class="form-label">规则优先级</label>
            <select v-model="devForm.decision_rules.priority" class="form-select">
              <option value="low">低 - 仅记录</option>
              <option value="medium">中 - 提醒用户</option>
              <option value="high">高 - 立即预警</option>
              <option value="critical">紧急 - 自动执行</option>
            </select>
          </div>
        </div>
        
        <!-- Preview -->
        <div class="dev-form-header">预览生成内容</div>
        <div class="dev-preview">
          <pre>{{ generateYamlPreview() }}</pre>
        </div>
        
        <div class="dev-form-actions">
          <button class="btn btn-primary" @click="saveUserKnowledge">保存知识</button>
          <button class="btn btn-outline" @click="loadExample">加载示例</button>
          <button class="btn btn-outline" @click="clearForm">清空表单</button>
        </div>
      </div>
      
      <!-- Manage Knowledge Tab -->
      <div v-if="activeDevTab === 'manage'" class="dev-tab-content">
        <h4>用户知识管理</h4>
        <div class="dev-info">系统默认知识：不可删除，仅可查看</div>
        
        <!-- Import/Export/Reload Actions -->
        <div class="dev-actions-row">
          <button class="btn btn-outline" @click="openImportModal">📥 导入知识</button>
          <button class="btn btn-outline" @click="showExportModal = true">📤 导出知识</button>
          <button class="btn btn-primary" @click="reloadKnowledge" :disabled="reloading">
            {{ reloading ? '⟳ 加载中...' : '🔄 加载知识' }}
          </button>
        </div>
        <div class="dev-info">添加知识后，点击"加载知识"按钮使其生效</div>
        
        <!-- Knowledge Files Table -->
        <div v-for="type in knowledgeTypes" :key="type.id" class="dev-knowledge-section">
          <div class="dev-knowledge-header" @click="type.expanded = !type.expanded">
            <span>{{ type.icon }} {{ type.label }} ({{ getTypeFiles(type.id).length }})</span>
            <span class="dev-arrow" :class="{ expanded: type.expanded }">▾</span>
          </div>
          <div v-if="type.expanded" class="dev-knowledge-content">
            <div v-if="getTypeFiles(type.id).length === 0" class="empty">暂无用户知识</div>
            <div v-else class="dev-table">
              <div class="dev-table-header">
                <span class="dev-table-col name">名称</span>
                <span class="dev-table-col time">添加时间</span>
                <span class="dev-table-col actions">操作</span>
              </div>
              <div v-for="file in getTypeFiles(type.id)" :key="file.path" class="dev-table-row">
                <span class="dev-table-col name">{{ file.name }}</span>
                <span class="dev-table-col time">{{ formatDate(file.modified) }}</span>
                <span class="dev-table-col actions">
                  <button class="btn-icon" @click="viewFile(file)">查看</button>
                  <button class="btn-icon danger" @click="deleteFile(file)">删除</button>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Import Modal -->
      <div v-if="showImportModal" class="dev-modal-overlay" @click.self="showImportModal = false">
        <div class="dev-modal">
          <div class="dev-modal-header">
            <h4>导入知识</h4>
            <button class="btn-icon" @click="showImportModal = false">✕</button>
          </div>
          <div class="dev-modal-content">
            <div class="dev-import-tabs">
              <button class="dev-import-tab" :class="{ active: importMode === 'file' }" @click="importMode = 'file'">📁 文件导入</button>
              <button class="dev-import-tab" :class="{ active: importMode === 'paste' }" @click="importMode = 'paste'">📋 手动输入</button>
            </div>

            <div v-if="importMode === 'file'">
              <div class="form-group">
                <label class="form-label">选择文件</label>
                <div class="dev-file-drop" :class="{ 'has-file': importFileForm.file }" @click="importFileInput.click()" @dragover.prevent="importFileForm.dragging = true" @dragleave="importFileForm.dragging = false" @drop.prevent="onImportFileDrop">
                  <input ref="importFileInput" type="file" accept=".zip,.yml,.yaml" style="display:none" @change="onImportFileSelect" />
                  <div v-if="importFileForm.file" class="dev-file-info">
                    <span class="dev-file-name">📄 {{ importFileForm.file.name }}</span>
                    <span class="dev-file-size">({{ formatFileSize(importFileForm.file.size) }})</span>
                    <button class="btn-icon danger" @click.stop="clearImportFile">✕</button>
                  </div>
                  <div v-else class="dev-file-placeholder">
                    <span>点击选择或拖拽文件到此处</span>
                    <span class="dev-file-hint">支持 ZIP压缩包、YAML文件</span>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="importFileForm.overwrite" />
                  <span>覆盖同名文件</span>
                </label>
              </div>
              <div v-if="importFileForm.error" class="dev-error">
                <div class="dev-error-title">{{ importFileForm.error }}</div>
                <div v-if="importFileForm.suggestion" class="dev-error-suggestion">{{ importFileForm.suggestion }}</div>
              </div>
            </div>

            <div v-if="importMode === 'paste'">
              <div class="form-group">
                <label class="form-label">知识类型</label>
                <select v-model="importForm.type" class="form-select">
                  <option value="crops">作物知识</option>
                  <option value="diseases">病虫害</option>
                  <option value="pesticides">农药</option>
                  <option value="varieties">品种库</option>
                  <option value="decision_rules">决策规则</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">粘贴YAML内容</label>
                <textarea v-model="importForm.content" class="form-textarea" rows="10" placeholder="name: 示例&#10;family: 茄科"></textarea>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="importForm.overwrite" />
                  <span>覆盖同名文件</span>
                </label>
              </div>
              <div v-if="importForm.error" class="dev-error">
                <div class="dev-error-title">{{ importForm.error }}</div>
                <div v-if="importForm.suggestion" class="dev-error-suggestion">{{ importForm.suggestion }}</div>
              </div>
            </div>
          </div>
          <div class="dev-modal-actions">
            <template v-if="importMode === 'paste'">
              <button class="btn btn-outline" @click="validateImport">预览验证</button>
              <button class="btn btn-primary" @click="importKnowledge">导入</button>
            </template>
            <template v-else>
              <button class="btn btn-primary" @click="importKnowledgeFile" :disabled="!importFileForm.file || importFileForm.importing">
                {{ importFileForm.importing ? '导入中...' : '导入' }}
              </button>
            </template>
            <button class="btn btn-outline" @click="showImportModal = false">取消</button>
          </div>
        </div>
      </div>
      
      <!-- Export Modal -->
      <div v-if="showExportModal" class="dev-modal-overlay" @click.self="showExportModal = false">
        <div class="dev-modal">
          <div class="dev-modal-header">
            <h4>导出知识</h4>
            <button class="btn-icon" @click="showExportModal = false">✕</button>
          </div>
          <div class="dev-modal-content">
            <div class="form-group">
              <label class="form-label">选择导出内容</label>
              <div class="dev-checkbox-group">
                <label v-for="type in knowledgeTypes" :key="type.id" class="checkbox-label">
                  <input type="checkbox" v-model="exportForm.types" :value="type.id" />
                  <span>{{ type.icon }} {{ type.label }} ({{ getTypeFiles(type.id).length }})</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">导出格式</label>
              <div class="dev-radio-group">
                <label class="radio-label">
                  <input type="radio" v-model="exportForm.format" value="zip" />
                  <span>ZIP压缩包（保留目录结构）</span>
                </label>
                <label class="radio-label">
                  <input type="radio" v-model="exportForm.format" value="single" />
                  <span>单个YAML文件（合并）</span>
                </label>
              </div>
            </div>
          </div>
          <div class="dev-modal-actions">
            <button class="btn btn-primary" @click="exportKnowledge">导出</button>
            <button class="btn btn-outline" @click="showExportModal = false">取消</button>
          </div>
        </div>
      </div>
      
      <!-- View File Modal -->
      <div v-if="showViewModal" class="dev-modal-overlay" @click.self="showViewModal = false">
        <div class="dev-modal">
          <div class="dev-modal-header">
            <h4>{{ viewFileData?.name }}</h4>
            <button class="btn-icon" @click="showViewModal = false">✕</button>
          </div>
          <div class="dev-modal-content">
            <pre class="dev-file-content">{{ viewFileContent }}</pre>
          </div>
          <div class="dev-modal-actions">
            <button class="btn btn-outline" @click="showViewModal = false">关闭</button>
          </div>
        </div>
      </div>
        </div><!-- End dev-modal-body -->
      </div><!-- End dev-modal-container -->
    </div><!-- End dev-modal-overlay -->

    <!-- Hidden Developer Options Entry -->
    <div v-if="!showDevOptions" class="dev-entry-hint" v-show="devTapCount > 0">
      再点 {{ 5 - devTapCount }} 次进入开发者模式
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
const weather = computed(() => store.weather);

const showKey = ref(false);
const aiTesting = ref(false);
const aiResult = ref(null);
const aiUsage = ref(null);
const aiAnalyzing = ref(false);
const analysisCooldown = ref(0);
const analysisResult = ref(null);
let cooldownTimer = null;
const locating = ref(false);
const modelsLoading = ref(false);
const models = ref([]);
const showModelDropdown = ref(false);

const sections = reactive({
  ai: false,
  weather: false,
  city: true,
  greenhouses: false,
  crops: false,
  templates: false,
  data: false,
  help: false
});


const configData = reactive({
  city: '', city_source: '',
  greenhouses: [], crops: [],
  ai: { enabled: false, api_base: '', api_key: '', model: '' }
});
const detectedIP = ref('');
const gpsCoords = ref('');
const manualCoords = ref('');
const coordsError = ref('');
const originalCity = ref('');

const sourceNames = { openMeteo: 'Open-Meteo', wttr: 'wttr.in' };

const templates = ref([]);

const showAddGreenhouse = ref(false);
const newGreenhouse = reactive({
  name: '', area: 500, type: '日光温室', orientation: '东西走向',
  cover_material: 'PO膜', insulation: '好（有加温设备）', ventilation: '自然通风',
  irrigation: '滴灌', heating: '无', shading: '无', insect_net: '无'
});

const showAddCrop = ref(false);
const newCrop = reactive({
  greenhouse_id: '', crop_type: '', custom_name: '', variety_name: '',
  planting_date: '', current_stage: '育苗期', quantity: 1000,
  seed_source: '国产品种', nursery_method: '自育苗', seedling_age: 15,
  grafted: '否', prev_crop: '', target_yield: 0, stage_detail: {},
  rotation_hint: '', rotation_ok: true
});
const addCropTypes = ref([]);
const addCropVarieties = ref([]);
const addCropStages = ref(['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期']);
const addStageDetailFields = ref([]);

const cities = ['北京', '上海', '广州', '深圳', '天津', '重庆', '石家庄', '太原', '沈阳', '哈尔滨', '南京', '杭州', '济南', '郑州', '武汉', '长沙', '成都', '西安', '兰州', '昆明', '乌鲁木齐', '寿光', '青州'];

function getSourceLocation(name) {
  const src = weather.value?.sources?.[name];
  if (!src || !src.current) return '';
  const city = src.city || '';
  const lat = src.lat != null ? Number(src.lat).toFixed(1) : '';
  const lon = src.lon != null ? Number(src.lon).toFixed(1) : '';
  const temp = src.current?.temperature != null ? `${src.current.temperature}°C` : '';
  const parts = [];
  if (city) parts.push(city);
  if (lat && lon) parts.push(`${lat},${lon}`);
  if (temp) parts.push(temp);
  return parts.join(' / ');
}

function toggleManualInput() {
  if (configData.city === '__manual__') {
    configData.city = '';
    manualCoords.value = '';
    coordsError.value = '';
  } else {
    configData.city = '__manual__';
  }
}

function validateCoords() {
  if (!manualCoords.value) {
    coordsError.value = '';
    return;
  }
  
  const coordsPattern = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
  if (!coordsPattern.test(manualCoords.value)) {
    coordsError.value = '格式错误：需要 "纬度, 经度"（只支持数字和小数点）';
    return;
  }
  
  const parts = manualCoords.value.split(',').map(s => s.trim());
  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);
  
  if (lat < -90 || lat > 90) {
    coordsError.value = '纬度范围：-90 到 90';
    return;
  }
  
  if (lon < -180 || lon > 180) {
    coordsError.value = '经度范围：-180 到 180';
    return;
  }
  
  coordsError.value = '';
}

const canApplyCity = computed(() => {
  if (configData.city && configData.city !== '__manual__') {
    return configData.city !== originalCity.value;
  }
  if (configData.city === '__manual__' && manualCoords.value) {
    return !coordsError.value;
  }
  return false;
});

const hasUnsavedChanges = computed(() => {
  if (configData.city !== originalCity.value) return true;
  if (manualCoords.value) return true;
  return false;
});

async function applyCitySettings() {
  if (!canApplyCity.value) return;
  
  if (configData.city === '__manual__' && manualCoords.value) {
    const parts = manualCoords.value.split(',').map(s => s.trim());
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    
    configData.lat = lat;
    configData.lon = lon;
    configData.city = `手动坐标 (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
    configData.city_source = '手动输入坐标';
    gpsCoords.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } else if (configData.city && configData.city !== '__manual__') {
    configData.city_source = '手动选择城市';
    configData.lat = null;
    configData.lon = null;
    gpsCoords.value = '';
  }
  
  await saveConfig();
  await store.updateWeather();
  
  if (configData.city && configData.city !== '__manual__' && store.weather?.sources) {
    const sources = store.weather.sources;
    const firstSource = sources.openMeteo || sources.wttr;
    if (firstSource?.lat && firstSource?.lon) {
      gpsCoords.value = `${Number(firstSource.lat).toFixed(4)}, ${Number(firstSource.lon).toFixed(4)}`;
    }
  }
  
  originalCity.value = configData.city;
  
  if (window.__modal) {
    window.__modal.showToast('位置设置已应用', 'success');
  }
}

async function detectLocation() {
  locating.value = true;
  configData.city_source = '定位中...';
  detectedIP.value = '';
  gpsCoords.value = '';

  let gotCoords = false;
  let gotCity = false;

  // Step 1: Try IP-based location
  try {
    const res = await axios.get('/api/config/locate', { timeout: 10000 });
    if (res.data?.success && res.data?.lat) {
      configData.lat = res.data.lat;
      configData.lon = res.data.lon;
      detectedIP.value = res.data.ip || '';
      gotCoords = true;
      if (res.data.city) {
        configData.city = res.data.city;
        configData.city_source = res.data.source || 'IP定位';
        gotCity = true;
      }
    }
  } catch (e) {}

  // Step 2: If no city name yet, try browser GPS
  if (!gotCity && navigator.geolocation) {
    configData.city_source = 'GPS定位中...';
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000, enableHighAccuracy: false
        });
      });
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      configData.lat = lat;
      configData.lon = lon;
      gpsCoords.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      gotCoords = true;

      try {
        const geoRes = await axios.get('/api/config/reverse-geocode', {
          params: { lat, lon }, timeout: 10000
        });
        if (geoRes.data?.success && geoRes.data?.city) {
          configData.city = geoRes.data.city;
          configData.city_source = `GPS (${geoRes.data.city})`;
          gotCity = true;
        }
      } catch (e) {}
    } catch (e) {}
  }

  if (gotCoords && !gpsCoords.value && configData.lat && configData.lon) {
    gpsCoords.value = `${Number(configData.lat).toFixed(4)}, ${Number(configData.lon).toFixed(4)}`;
  }

  // Step 3: Always write to city field when we have coordinates
  if (gotCoords && !gotCity) {
    const latStr = configData.lat.toFixed(2);
    const lonStr = configData.lon.toFixed(2);
    configData.city = `当前位置 (${latStr}, ${lonStr})`;
    configData.city_source = `坐标定位 (${latStr}, ${lonStr})`;
  }

  if (gotCity) {
    if (window.__modal) window.__modal.showToast(`已定位到：${configData.city}`, 'success');
  } else if (gotCoords) {
    if (window.__modal) window.__modal.showToast('定位成功，天气数据可用', 'success');
  } else {
    configData.city_source = '定位失败，请手动输入城市';
    if (window.__modal) window.__modal.showToast('自动定位失败，请手动输入城市', 'error');
  }

  await saveConfig();
  await store.updateWeather();
  locating.value = false;
}

async function loadConfig() {
  try {
    const res = await axios.get('/api/config');
    Object.assign(configData, res.data);
    originalCity.value = configData.city || '';
  } catch (e) {}
}

async function saveConfig() {
  try {
    await axios.put('/api/config', configData);
    await store.fetchConfig();
  } catch (e) { if (window.__modal) window.__modal.showToast('保存失败', 'error'); }
}

async function testAI() {
  aiTesting.value = true;
  aiResult.value = null;
  try {
    const res = await axios.post('/api/ai/test', configData.ai);
    aiResult.value = res.data;
    // Auto-save config after successful test
    if (res.data?.success) {
      await saveConfig();
      if (window.__modal) window.__modal.showToast(`连接成功 - ${res.data.model} (${res.data.responseTime}ms)`, 'success');
    }
  } catch (err) {
    aiResult.value = { error: err.response?.data?.error || err.message };
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || err.message || '测试失败', 'error');
  } finally {
    aiTesting.value = false;
  }
}

async function fetchModels() {
  if (!configData.ai.api_base || !configData.ai.api_key) {
    if (window.__modal) window.__modal.showToast('请先填写接口地址和API密钥', 'error');
    return;
  }
  
  modelsLoading.value = true;
  showModelDropdown.value = false;
  
  try {
    const res = await axios.get('/api/ai/models', { timeout: 20000 });
    if (res.data?.success && res.data.models?.length) {
      models.value = res.data.models;
      showModelDropdown.value = true;
    } else {
      if (window.__modal) window.__modal.showToast('未获取到可用模型', 'error');
    }
  } catch (err) {
    const msg = err.response?.data?.error || '获取模型列表失败';
    if (window.__modal) window.__modal.showToast(msg, 'error');
  } finally {
    modelsLoading.value = false;
  }
}

function selectModel(model) {
  configData.ai.model = model;
  showModelDropdown.value = false;
  saveConfig();
}

async function loadAiUsage() {
  try { 
    const res = await axios.get('/api/ai/usage'); 
    aiUsage.value = res.data;
    if (res.data.cooldown_remaining) {
      analysisCooldown.value = res.data.cooldown_remaining;
      startCooldownTimer();
    }
  } catch (e) {}
}

async function runAnalysis() {
  if (!configData.ai.enabled) {
    if (window.__modal) window.__modal.showToast('请先启用 AI 功能', 'error');
    return;
  }
  if (!configData.ai.api_base || !configData.ai.api_key || !configData.ai.model) {
    if (window.__modal) window.__modal.showToast('请先完成接口配置', 'error');
    return;
  }
  aiAnalyzing.value = true;
  try {
    const res = await axios.post('/api/ai/analyze', {});
    analysisResult.value = res.data.result;
    if (res.data.cooldown) {
      analysisCooldown.value = res.data.cooldown;
      startCooldownTimer();
    }
    try { await axios.post('/api/ai/results/analysis', { result: res.data.result }); } catch (_) {}
    const analyses = res.data.result?.crop_analyses;
    let toastMsg = '分析完成';
    if (analyses?.length) {
      toastMsg = analyses.map(a => {
        const name = `${a.greenhouse_name || ''}·${a.crop_type || ''} ${a.variety_name || ''}`.trim();
        return `${name}：${a.operation_advice?.summary || ''}`;
      }).join(' | ');
    } else {
      const advice = res.data.result?.operation_advice?.summary || '';
      const risk = res.data.result?.risk_warning?.summary || '';
      toastMsg = `${advice}${risk ? ' | ⚠' + risk : ''}`;
    }
    if (window.__modal) {
      window.__modal.showToast(`✅ ${toastMsg}`, 'success', 5000);
    }
  } catch (err) {
    const msg = err.response?.data?.error || 'AI 分析失败';
    if (window.__modal) window.__modal.showToast(msg, 'error');
    if (err.response?.data?.cooldown) {
      analysisCooldown.value = err.response.data.cooldown;
      startCooldownTimer();
    }
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

function getCropIcon(cropType) {
  const icons = {
    '番茄': '🍅', '黄瓜': '🥒', '辣椒': '🌶️', '茄子': '🍆',
    '草莓': '🍓', '西瓜': '🍉', '甜瓜': '🍈', '生菜': '🥬',
    '白菜': '🥬', '萝卜': '🥕', '胡萝卜': '🥕', '玉米': '🌽'
  };
  return icons[cropType] || '🌱';
}

function getPriorityClass(priority) {
  if (priority === '紧急' || priority === '高') return 'high';
  if (priority === '重要' || priority === '中') return 'medium';
  return 'low';
}

async function deleteGreenhouse(id) {
  const ok = window.__modal ? await window.__modal.showConfirm('确认删除此棚区？', '删除棚区') : false;
  if (!ok) return;
  try {
    await axios.delete(`/api/greenhouses/${id}`);
    await loadConfig();
  } catch (err) { if (window.__modal) window.__modal.showToast(err.response?.data?.error || '删除失败', 'error'); }
}

async function editCropStage(crop) {
  const stages = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
  if (!window.__modal) return;
  const options = stages.map(s => ({ label: s, value: s }));
  const newStage = await window.__modal.showPrompt(`当前阶段：${crop.current_stage}`, '修改生长阶段', { default: crop.current_stage }, options);
  if (!newStage || newStage === crop.current_stage) return;
  const confirmed = await window.__modal.showConfirm(`确认将 ${crop.type} ${crop.variety_name} 的阶段修改为 ${newStage}？`, '确认修改');
  if (!confirmed) return;
  try {
    await axios.put(`/api/crops/${crop.id}`, { current_stage: newStage });
    await loadConfig();
  } catch (err) { window.__modal.showToast('修改失败', 'error'); }
}

async function submitNewGreenhouse() {
  if (!newGreenhouse.name) {
    if (window.__modal) window.__modal.showToast('请输入棚区名称', 'error');
    return;
  }
  try {
    await axios.post('/api/greenhouses', newGreenhouse);
    showAddGreenhouse.value = false;
    Object.assign(newGreenhouse, { name: '', area: 500, type: '日光温室', orientation: '东西走向', cover_material: 'PO膜', insulation: '好（有加温设备）', ventilation: '自然通风', irrigation: '滴灌', heating: '无', shading: '无', insect_net: '无' });
    await loadConfig();
    if (window.__modal) window.__modal.showToast('棚区添加成功', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '添加失败', 'error');
  }
}

async function loadAddCropTypes() {
  try {
    const res = await axios.get('/api/crops/available-types');
    addCropTypes.value = res.data.map(t => t.name);
  } catch (e) {
    addCropTypes.value = ['番茄', '黄瓜', '辣椒'];
  }
}

async function loadAddCropVarieties(cropType) {
  if (!cropType || cropType === '其他') { addCropVarieties.value = []; return; }
  try {
    const res = await axios.get(`/api/knowledge/varieties/${cropType}`);
    addCropVarieties.value = res.data || [];
  } catch (e) {
    addCropVarieties.value = [];
  }
}

async function loadAddCropStages(cropType) {
  if (!cropType || cropType === '其他') { addCropStages.value = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期']; addStageDetailFields.value = []; return; }
  try {
    const res = await axios.get(`/api/knowledge/crops/${cropType}`);
    if (res.data?.stages?.length) {
      addCropStages.value = res.data.stages.sort((a, b) => (a.order || 0) - (b.order || 0)).map(s => s.name);
      addCropStageDetailsMap.value = {};
      for (const stage of res.data.stages) {
        addCropStageDetailsMap.value[stage.name] = stage.detail_fields || [];
      }
    } else {
      addCropStages.value = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
      addCropStageDetailsMap.value = {};
    }
  } catch (e) {
    addCropStages.value = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
    addCropStageDetailsMap.value = {};
  }
}

const addCropStageDetailsMap = ref({});

function onNewCropTypeChange() {
  newCrop.variety_name = '';
  newCrop.stage_detail = {};
  newCrop.rotation_hint = '';
  const ct = newCrop.crop_type;
  if (ct && ct !== '其他') {
    loadAddCropVarieties(ct);
    loadAddCropStages(ct);
  } else {
    addCropVarieties.value = [];
    addCropStages.value = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];
    addStageDetailFields.value = [];
    addCropStageDetailsMap.value = {};
  }
}

function onNewStageChange() {
  newCrop.stage_detail = {};
  const stage = newCrop.current_stage;
  const fields = addCropStageDetailsMap.value[stage] || [];
  addStageDetailFields.value = fields;
  for (const field of fields) {
    if (field.type === 'stepper') {
      newCrop.stage_detail[field.name] = field.min || 0;
    }
  }
}

function stepNewCrop(key, delta, min, max) {
  const current = newCrop[key] || 0;
  newCrop[key] = Math.max(min, Math.min(max, current + delta));
}

function stepNewCropDetail(fieldName, delta, min, max) {
  const current = newCrop.stage_detail[fieldName] || 0;
  newCrop.stage_detail[fieldName] = Math.max(min, Math.min(max, current + delta));
}

const familyMap = {
  '番茄': '茄科', '辣椒': '茄科', '茄子': '茄科',
  '黄瓜': '葫芦科', '西瓜': '葫芦科', '甜瓜': '葫芦科', '南瓜': '葫芦科', '西葫芦': '葫芦科', '苦瓜': '葫芦科',
  '生菜': '菊科', '油菜': '十字花科', '菠菜': '藜科', '芹菜': '伞形科',
  '大白菜': '十字花科', '甘蓝': '十字花科', '花椰菜': '十字花科', '萝卜': '十字花科',
  '草莓': '蔷薇科', '豆角': '豆科'
};

function checkNewCropRotation() {
  if (!newCrop.prev_crop || newCrop.prev_crop === '首次种植') {
    newCrop.rotation_hint = newCrop.prev_crop === '首次种植' ? '首次种植，无轮作风险' : '';
    newCrop.rotation_ok = true;
    return;
  }
  const prevFamily = familyMap[newCrop.prev_crop] || '';
  const currFamily = familyMap[newCrop.crop_type] || '';
  if (!prevFamily || !currFamily) {
    newCrop.rotation_hint = '';
    return;
  }
  if (prevFamily === currFamily) {
    newCrop.rotation_hint = `上茬${newCrop.prev_crop}属${prevFamily}，当前${newCrop.crop_type}属${currFamily}，同科连作风险较高，建议加强土壤消毒`;
    newCrop.rotation_ok = false;
  } else {
    newCrop.rotation_hint = `上茬${newCrop.prev_crop}属${prevFamily}，当前${newCrop.crop_type}属${currFamily}，轮作合理`;
    newCrop.rotation_ok = true;
  }
}

function openAddCropForm() {
  showAddCrop.value = true;
  loadAddCropTypes();
}

async function submitNewCrop() {
  if (!newCrop.greenhouse_id) {
    if (window.__modal) window.__modal.showToast('请选择所属棚区', 'error');
    return;
  }
  if (!newCrop.crop_type) {
    if (window.__modal) window.__modal.showToast('请选择作物类型', 'error');
    return;
  }
  if (!newCrop.planting_date) {
    if (window.__modal) window.__modal.showToast('请选择定植日期', 'error');
    return;
  }
  try {
    const payload = {
      ...newCrop,
      crop_type: newCrop.crop_type === '其他' ? newCrop.custom_name : newCrop.crop_type
    };
    await axios.post('/api/crops', payload);
    showAddCrop.value = false;
    Object.assign(newCrop, { greenhouse_id: '', crop_type: '', custom_name: '', variety_name: '', planting_date: '', current_stage: '育苗期', quantity: 1000, seed_source: '国产品种', nursery_method: '自育苗', seedling_age: 15, grafted: '否', prev_crop: '', target_yield: 0, stage_detail: {}, rotation_hint: '', rotation_ok: true });
    addStageDetailFields.value = [];
    await loadConfig();
    if (window.__modal) window.__modal.showToast('作物添加成功', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '添加失败', 'error');
  }
}

function exportData() { window.open('/api/data-records/export'); }
function exportOps() { window.open('/api/operations/export'); }

async function reinit() {
  if (!window.__modal) return;
  const ok1 = await window.__modal.showConfirm('确认重新初始化？这将清除所有配置、操作记录、天气历史等全部数据。', '第一次确认');
  if (!ok1) return;
  const ok2 = await window.__modal.showConfirm('再次确认：此操作不可恢复，所有数据将被永久删除！', '第二次确认');
  if (!ok2) return;
  const text = await window.__modal.showPrompt('请输入"确认删除"以完成操作', '最终确认', { placeholder: '确认删除' });
  if (text !== '确认删除') {
    if (window.__modal) window.__modal.showToast('输入不正确，已取消', 'error');
    return;
  }
  try {
    await axios.delete('/api/init');
    await store.fetchConfig();
    if (window.__modal) await window.__modal.showAlert('所有数据已清除，即将进入初始化', '清除成功');
    router.push('/setup');
  } catch (err) {
    if (window.__modal) window.__modal.showToast('清除失败: ' + (err.response?.data?.error || err.message), 'error');
  }
}

// Developer options
const showDevOptions = ref(false);
const devTapCount = ref(0);
const activeDevTab = ref('add');
const devTabs = [
  { id: 'add', icon: '➕', label: '添加知识' },
  { id: 'manage', icon: '📋', label: '知识管理' }
];

const knowledgeTypes = reactive([
  { id: 'crops', icon: '🌱', label: '作物知识', expanded: true },
  { id: 'diseases', icon: '🐛', label: '病虫害', expanded: false },
  { id: 'pesticides', icon: '💊', label: '农药', expanded: false },
  { id: 'varieties', icon: '🌾', label: '品种库', expanded: false },
  { id: 'decision_rules', icon: '📏', label: '决策规则', expanded: false }
]);

const existingCrops = ref(['番茄', '黄瓜', '辣椒', '茄子', '豆角', '西瓜', '甜瓜', '南瓜', '西葫芦', '苦瓜', '生菜', '油菜', '菠菜', '芹菜', '大白菜', '甘蓝', '花椰菜', '草莓', '萝卜']);
const isCustomCropName = ref(false);
const isCustomVarietyCrop = ref(false);

const devForm = reactive({
  type: 'crops',
  crops: {
    name: '',
    customName: '',
    family: '',
    latin_name: '',
    total_days: 150,
    stages: [],
    diseases_text: ''
  },
  diseases: {
    name: '',
    alias: '',
    pathogen_type: '虫害',
    pathogen_name: '',
    firstCrop: '',
    crops_text: '',
    symptoms_leaf: '',
    symptoms_stem: '',
    symptoms_plant: '',
    agricultural_control_text: '',
    physical_control_text: '',
    biological_control_text: ''
  },
  pesticides: {
    name: '',
    type: '杀虫剂',
    active_ingredient: '',
    safety_interval_days: 7,
    applicable_crops_text: '',
    control_targets_text: '',
    dilution: '',
    dosage: ''
  },
  varieties: {
    crop: '',
    customCrop: '',
    list: []
  },
  decision_rules: {
    name: '',
    rule_type: 'irrigation',
    description: '',
    conditions: [],
    actions: [],
    priority: 'medium'
  }
});

const userKnowledgeFiles = ref([]);
const showImportModal = ref(false);
const showExportModal = ref(false);
const showViewModal = ref(false);
const viewFileData = ref(null);
const viewFileContent = ref('');
const reloading = ref(false);

const importForm = reactive({
  type: 'crops',
  content: '',
  overwrite: false,
  error: '',
  suggestion: ''
});

const importMode = ref('file');
const importFileInput = ref(null);
const importFileForm = reactive({
  file: null,
  overwrite: false,
  dragging: false,
  importing: false,
  error: '',
  suggestion: ''
});

const exportForm = reactive({
  types: [],
  format: 'zip'
});

function onVersionTap() {
  devTapCount.value++;
  if (devTapCount.value >= 5) {
    showDevOptions.value = true;
    devTapCount.value = 0;
    loadUserKnowledgeFiles();
  }
  setTimeout(() => { devTapCount.value = 0; }, 3000);
}

function openImportModal() {
  importMode.value = 'file';
  importFileForm.file = null;
  importFileForm.overwrite = false;
  importFileForm.error = '';
  importFileForm.suggestion = '';
  importForm.error = '';
  importForm.suggestion = '';
  showImportModal.value = true;
}

function onTypeChange() {
  // Reset form when type changes
}

function onCropNameChange() {
  if (devForm.crops.name === '__custom__') {
    isCustomCropName.value = true;
    devForm.crops.customName = '';
  } else {
    isCustomCropName.value = false;
    devForm.crops.customName = '';
  }
}

function onCustomCropNameInput() {
  // Limit to 6 characters
  if (devForm.crops.customName.length > 6) {
    devForm.crops.customName = devForm.crops.customName.slice(0, 6);
  }
}

function onVarietyCropChange() {
  if (devForm.varieties.crop === '__custom__') {
    isCustomVarietyCrop.value = true;
    devForm.varieties.customCrop = '';
  } else {
    isCustomVarietyCrop.value = false;
    devForm.varieties.customCrop = '';
  }
}

function onCustomVarietyCropInput() {
  // Limit to 6 characters
  if (devForm.varieties.customCrop.length > 6) {
    devForm.varieties.customCrop = devForm.varieties.customCrop.slice(0, 6);
  }
}

function addCondition() {
  devForm.decision_rules.conditions.push({
    metric: '',
    operator: '>',
    value: ''
  });
}

function addRuleAction() {
  devForm.decision_rules.actions.push({
    type: '',
    message: ''
  });
}

function addCropStage() {
  devForm.crops.stages.push({
    name: '',
    order: devForm.crops.stages.length + 1,
    typical_days: 0,
    description: '',
    key_points_text: '',
    temperature_day: '',
    temperature_night: '',
    watering: '',
    fertilization: '',
    pest_watch_text: ''
  });
}

function addVariety() {
  devForm.varieties.list.push({
    name: '',
    characteristics_text: ''
  });
}

function generateYamlPreview() {
  const data = formDataToYaml();
  if (!data) return '# 请填写表单内容';
  
  // Simple YAML generation for preview
  return objectToYaml(data, 0);
}

function objectToYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === '') continue;
    
    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}  -\n`;
          for (const [k, v] of Object.entries(item)) {
            if (v === undefined || v === null || v === '') continue;
            if (typeof v === 'object') {
              yaml += `${spaces}    ${k}:\n`;
              for (const [k2, v2] of Object.entries(v)) {
                if (v2 !== undefined && v2 !== null && v2 !== '') {
                  yaml += `${spaces}      ${k2}: "${v2}"\n`;
                }
              }
            } else {
              yaml += `${spaces}    ${k}: ${typeof v === 'string' ? `"${v}"` : v}\n`;
            }
          }
        } else {
          yaml += `${spaces}  - ${typeof item === 'string' ? `"${item}"` : item}\n`;
        }
      }
    } else if (typeof obj[key] === 'object') {
      yaml += `${spaces}${key}:\n`;
      for (const [k, v] of Object.entries(obj[key])) {
        if (v !== undefined && v !== null && v !== '') {
          yaml += `${spaces}  ${k}: ${typeof v === 'string' ? `"${v}"` : v}\n`;
        }
      }
    } else {
      yaml += `${spaces}${key}: ${typeof value === 'string' ? `"${value}"` : value}\n`;
    }
  }
  
  return yaml;
}

function formDataToYaml() {
  const type = devForm.type;
  
  switch (type) {
    case 'crops': {
      // Get crop name - either from select or custom input
      const cropName = devForm.crops.name === '__custom__' ? devForm.crops.customName : devForm.crops.name;
      if (!cropName || !devForm.crops.family) return null;
      return {
        name: cropName,
        family: devForm.crops.family,
        latin_name: devForm.crops.latin_name || undefined,
        total_days: devForm.crops.total_days || undefined,
        stages: devForm.crops.stages.map(stage => ({
          name: stage.name,
          order: stage.order,
          typical_days: stage.typical_days || undefined,
          description: stage.description || undefined,
          key_points: stage.key_points_text ? stage.key_points_text.split('\n').filter(s => s.trim()) : undefined,
          temperature: (stage.temperature_day || stage.temperature_night) ? {
            day: stage.temperature_day || undefined,
            night: stage.temperature_night || undefined
          } : undefined,
          watering: stage.watering || undefined,
          fertilization: stage.fertilization || undefined,
          pest_watch: stage.pest_watch_text ? stage.pest_watch_text.split('\n').filter(s => s.trim()) : undefined
        })),
        diseases: devForm.crops.diseases_text ? devForm.crops.diseases_text.split('\n').filter(s => s.trim()) : undefined
      };
    }
      
    case 'diseases': {
      if (!devForm.diseases.name || !devForm.diseases.firstCrop) return null;
      // 构建crops数组：第一个是选择的主要作物，后面是文本框中的其他作物
      const cropsList = [devForm.diseases.firstCrop];
      if (devForm.diseases.crops_text) {
        const otherCrops = devForm.diseases.crops_text.split('\n').filter(s => s.trim());
        cropsList.push(...otherCrops);
      }
      return {
        name: devForm.diseases.name,
        alias: devForm.diseases.alias || undefined,
        pathogen_type: devForm.diseases.pathogen_type,
        pathogen_name: devForm.diseases.pathogen_name || undefined,
        crops: cropsList,
        symptoms: {
          leaf: devForm.diseases.symptoms_leaf || undefined,
          stem: devForm.diseases.symptoms_stem || undefined,
          plant: devForm.diseases.symptoms_plant || undefined
        },
        agricultural_control: devForm.diseases.agricultural_control_text ? devForm.diseases.agricultural_control_text.split('\n').filter(s => s.trim()) : undefined,
        physical_control: devForm.diseases.physical_control_text ? devForm.diseases.physical_control_text.split('\n').filter(s => s.trim()) : undefined,
        biological_control: devForm.diseases.biological_control_text ? devForm.diseases.biological_control_text.split('\n').filter(s => s.trim()) : undefined
      };
    }
      
    case 'pesticides':
      if (!devForm.pesticides.name) return null;
      return {
        name: devForm.pesticides.name,
        type: devForm.pesticides.type,
        active_ingredient: devForm.pesticides.active_ingredient || undefined,
        safety_interval_days: devForm.pesticides.safety_interval_days || undefined,
        applicable_crops: devForm.pesticides.applicable_crops_text ? devForm.pesticides.applicable_crops_text.split('\n').filter(s => s.trim()) : undefined,
        control_targets: devForm.pesticides.control_targets_text ? devForm.pesticides.control_targets_text.split('\n').filter(s => s.trim()) : undefined,
        dilution: devForm.pesticides.dilution || undefined,
        dosage: devForm.pesticides.dosage || undefined
      };
      
    case 'varieties': {
      // Get crop type - either from select or custom input
      const cropType = devForm.varieties.crop === '__custom__' ? devForm.varieties.customCrop : devForm.varieties.crop;
      if (!cropType) return null;
      return {
        name: cropType,
        crop: cropType,
        varieties: devForm.varieties.list.map(v => ({
          name: v.name,
          characteristics: v.characteristics_text ? v.characteristics_text.split('\n').filter(s => s.trim()) : undefined
        }))
      };
    }
      
    case 'decision_rules':
      if (!devForm.decision_rules.name) return null;
      return {
        name: devForm.decision_rules.name,
        rule_type: devForm.decision_rules.rule_type,
        description: devForm.decision_rules.description || undefined,
        conditions: devForm.decision_rules.conditions.length > 0 ? devForm.decision_rules.conditions : undefined,
        actions: devForm.decision_rules.actions.length > 0 ? devForm.decision_rules.actions : undefined,
        priority: devForm.decision_rules.priority || undefined
      };
      
    default:
      return null;
  }
}

async function saveUserKnowledge() {
  const data = formDataToYaml();
  if (!data) {
    if (window.__modal) window.__modal.showToast('请填写必填字段', 'error');
    return;
  }
  
  try {
    const content = objectToYaml(data, 0);
    
    const res = await axios.post('/api/knowledge/user', {
      type: devForm.type,
      name: data.name,
      content
    });
    
    if (window.__modal) {
      window.__modal.showToast(
        `知识已保存到 ${res.data.path || ''}，请点击"加载知识"按钮使其生效`, 
        'success'
      );
    }
    clearForm();
    loadUserKnowledgeFiles();
  } catch (err) {
    if (window.__modal) window.__modal.showToast(err.response?.data?.error || '添加失败', 'error');
  }
}

function loadExample() {
  const examples = {
    crops: {
      name: '示例作物',
      family: '茄科',
      latin_name: 'Solanum example',
      total_days: 120,
      stages: [
        {
          name: '育苗期',
          order: 1,
          typical_days: 30,
          description: '从播种到定植前',
          key_points_text: '温度管理促壮苗\n适当控水蹲苗',
          temperature_day: '25-30°C',
          temperature_night: '15-18°C',
          watering: '控水蹲苗',
          fertilization: '苗期轻施',
          pest_watch_text: '猝倒病\n立枯病'
        }
      ],
      diseases_text: '蚜虫\n白粉虱'
    },
    diseases: {
      name: '示例病害',
      alias: '示例别名',
      pathogen_type: '病害',
      pathogen_name: '示例病原',
      crops_text: '番茄\n黄瓜',
      symptoms_leaf: '叶片出现病斑',
      symptoms_stem: '茎秆变色',
      symptoms_plant: '植株萎蔫',
      agricultural_control_text: '轮作倒茬\n清洁田园',
      physical_control_text: '防虫网隔离',
      biological_control_text: '释放天敌'
    },
    pesticides: {
      name: '示例农药',
      type: '杀虫剂',
      active_ingredient: '示例成分',
      safety_interval_days: 7,
      applicable_crops_text: '番茄\n黄瓜',
      control_targets_text: '蚜虫\n白粉虱',
      dilution: '2000倍',
      dosage: '10g/亩'
    }
  };
  
  if (examples[devForm.type]) {
    Object.assign(devForm[devForm.type], examples[devForm.type]);
  }
}

function clearForm() {
  const defaults = {
    crops: {
      name: '',
      customName: '',
      family: '',
      latin_name: '',
      total_days: 150,
      stages: [],
      diseases_text: ''
    },
    diseases: {
      name: '',
      alias: '',
      pathogen_type: '虫害',
      pathogen_name: '',
      firstCrop: '',
      crops_text: '',
      symptoms_leaf: '',
      symptoms_stem: '',
      symptoms_plant: '',
      agricultural_control_text: '',
      physical_control_text: '',
      biological_control_text: ''
    },
    pesticides: {
      name: '',
      type: '杀虫剂',
      active_ingredient: '',
      safety_interval_days: 7,
      applicable_crops_text: '',
      control_targets_text: '',
      dilution: '',
      dosage: ''
    },
    varieties: {
      crop: '',
      customCrop: '',
      list: []
    },
    decision_rules: {
      name: '',
      rule_type: 'irrigation',
      description: '',
      conditions: [],
      actions: [],
      priority: 'medium'
    }
  };
  
  if (defaults[devForm.type]) {
    Object.assign(devForm[devForm.type], defaults[devForm.type]);
  }
  isCustomCropName.value = false;
  isCustomVarietyCrop.value = false;
}

function getTypeFiles(typeId) {
  return userKnowledgeFiles.value.filter(f => f.type === typeId);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

async function viewFile(file) {
  viewFileData.value = file;
  try {
    const res = await axios.get(`/api/knowledge/user-files/${file.path}`);
    viewFileContent.value = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
  } catch (e) {
    viewFileContent.value = '无法加载文件内容';
  }
  showViewModal.value = true;
}

async function deleteFile(file) {
  const ok = window.__modal ? await window.__modal.showConfirm(`确认删除 ${file.name}？`, '删除知识') : false;
  if (!ok) return;
  
  try {
    await axios.delete(`/api/knowledge/user/${file.path}`);
    if (window.__modal) window.__modal.showToast('删除成功', 'success');
    loadUserKnowledgeFiles();
  } catch (err) {
    if (window.__modal) window.__modal.showToast('删除失败: ' + (err.response?.data?.error || err.message), 'error');
  }
}

async function validateImport() {
  importForm.error = '';
  importForm.suggestion = '';
  
  try {
    const res = await axios.post(`/api/knowledge/validate/${importForm.type}`, {
      content: importForm.content
    });
    
    if (res.data.valid) {
      if (window.__modal) window.__modal.showToast('验证通过，可以导入', 'success');
    } else {
      importForm.error = '格式验证失败';
      importForm.suggestion = res.data.errors.join('；');
    }
  } catch (err) {
    importForm.error = err.response?.data?.error || '验证失败';
    importForm.suggestion = err.response?.data?.suggestion || '';
  }
}

async function importKnowledge() {
  importForm.error = '';
  importForm.suggestion = '';
  
  try {
    const res = await axios.post('/api/knowledge/import', {
      type: importForm.type,
      content: importForm.content,
      overwrite: importForm.overwrite
    });
    
    if (res.data.success) {
      if (window.__modal) window.__modal.showToast('导入成功', 'success');
      showImportModal.value = false;
      importForm.content = '';
      loadUserKnowledgeFiles();
    }
  } catch (err) {
    importForm.error = err.response?.data?.error || '导入失败';
    importForm.suggestion = err.response?.data?.suggestion || '';
  }
}

function onImportFileSelect(e) {
  const file = e.target.files[0];
  if (file) importFileForm.file = file;
}

function onImportFileDrop(e) {
  importFileForm.dragging = false;
  const file = e.dataTransfer.files[0];
  if (file) importFileForm.file = file;
}

function clearImportFile() {
  importFileForm.file = null;
  importFileForm.error = '';
  importFileForm.suggestion = '';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function importKnowledgeFile() {
  if (!importFileForm.file) return;
  importFileForm.error = '';
  importFileForm.suggestion = '';
  importFileForm.importing = true;

  try {
    const formData = new FormData();
    formData.append('file', importFileForm.file);
    formData.append('overwrite', String(importFileForm.overwrite));

    const res = await axios.post('/api/knowledge/import-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    if (res.data.success) {
      const msg = res.data.message;
      if (window.__modal) window.__modal.showToast(msg, 'success');
      showImportModal.value = false;
      clearImportFile();
      loadUserKnowledgeFiles();
    }
  } catch (err) {
    importFileForm.error = err.response?.data?.error || '导入失败';
    importFileForm.suggestion = err.response?.data?.suggestion || '';
    const details = err.response?.data?.details;
    if (details && details.length > 0) {
      importFileForm.suggestion = details.map(d => `${d.file || d.name || ''}: ${d.error}`).join('；');
    }
  } finally {
    importFileForm.importing = false;
  }
}

async function exportKnowledge() {
  if (exportForm.types.length === 0) {
    if (window.__modal) window.__modal.showToast('请选择要导出的知识类型', 'error');
    return;
  }
  
  try {
    const params = new URLSearchParams({
      types: exportForm.types.join(','),
      format: exportForm.format
    });
    
    const response = await axios.get(`/api/knowledge/export?${params}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', exportForm.format === 'zip' ? 'knowledge-export.zip' : 'knowledge-export.yml');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    showExportModal.value = false;
    if (window.__modal) window.__modal.showToast('导出成功', 'success');
  } catch (err) {
    if (window.__modal) window.__modal.showToast('导出失败', 'error');
  }
}

async function loadUserKnowledgeFiles() {
  try {
    const res = await axios.get('/api/knowledge/user-files');
    userKnowledgeFiles.value = res.data;
  } catch (e) {
    userKnowledgeFiles.value = [];
  }
}

async function reloadKnowledge() {
  reloading.value = true;
  try {
    const res = await axios.post('/api/knowledge/reload');
    if (res.data.success) {
      if (window.__modal) window.__modal.showToast(`知识加载成功，共加载 ${res.data.count} 个文件`, 'success');
      // 刷新文件列表
      await loadUserKnowledgeFiles();
    }
  } catch (err) {
    if (window.__modal) window.__modal.showToast('加载失败: ' + (err.response?.data?.error || err.message), 'error');
  } finally {
    reloading.value = false;
  }
}

async function loadTemplates() {
  try { const res = await axios.get('/api/templates'); templates.value = res.data; } catch (e) {}
}


async function deleteTemplate(id) {
  const ok = window.__modal ? await window.__modal.showConfirm('确认删除此模板？', '删除模板') : false;
  if (!ok) return;
  try { await axios.delete(`/api/templates/${id}`); loadTemplates(); } catch (e) {}
}



onMounted(() => {
  loadConfig();
  loadAiUsage();
  loadTemplates();
  store.fetchWeather();
});
</script>

<style scoped>
.city-row { display: flex; gap: 8px; align-items: center; }
.city-input { flex: 1; }

.city-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
}

.city-main-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.city-input-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.city-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 52px;
}

.city-select {
  flex: 1;
  height: 32px;
  font-size: 12px;
  padding: 4px 8px;
}

.city-select:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-coord {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-coord:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(45, 125, 70, 0.04);
}

.btn-coord.active {
  border-color: var(--primary);
  color: var(--primary);
  background: rgba(45, 125, 70, 0.08);
  font-weight: 500;
}

.city-coords-row {
  display: flex;
  gap: 6px;
  align-items: center;
  background: rgba(45, 125, 70, 0.04);
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(45, 125, 70, 0.1);
}

.coords-input-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.coords-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 60px;
}

.coords-input {
  flex: 1;
  height: 28px;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 12px;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
}

.coords-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(45, 125, 70, 0.1);
}

.error-hint {
  font-size: 10px;
  color: #d32f2f;
  background: #ffebee;
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 6px;
}

.city-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.city-actions-row .btn {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 15px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.city-actions-row .btn-outline {
  background: #fff;
  border: 1px solid var(--primary);
  color: var(--primary);
}

.city-actions-row .btn-outline:hover:not(:disabled) {
  background: rgba(45, 125, 70, 0.08);
}

.city-actions-row .btn-primary {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: #fff;
}

.city-actions-row .btn-primary:hover:not(:disabled) {
  background: var(--primary-dark, #388e3c);
  border-color: var(--primary-dark, #388e3c);
}

.city-actions-row .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.city-actions-row .loc-item:first-of-type {
  margin-left: 6px;
  padding-left: 10px;
  border-left: 1px solid rgba(45, 125, 70, 0.2);
}

.city-actions-row .loc-item {
  height: 24px;
}

.settings-card { margin-bottom: 8px; }
.card-title { cursor: pointer; user-select: none; }

.source-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.source-name { font-weight: 600; min-width: 80px; }
.source-location { flex: 1; text-align: center; font-size: 12px; color: var(--text-secondary); }

.location-info { 
  display: flex; 
  flex-wrap: wrap; 
  gap: 6px; 
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed rgba(45, 125, 70, 0.15);
}
.loc-item { 
  font-size: 10px; 
  color: var(--primary); 
  background: linear-gradient(135deg, rgba(45, 125, 70, 0.08), rgba(45, 125, 70, 0.04)); 
  padding: 2px 6px; 
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.loc-item::before {
  content: '';
  width: 4px;
  height: 4px;
  background: var(--primary);
  border-radius: 50%;
  opacity: 0.6;
}
.loc-pending { 
  color: #f57c00; 
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.12), rgba(255, 152, 0, 0.06)); 
  animation: pulse-warning 2s infinite;
}
.loc-pending::before {
  background: #f57c00;
}

@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.list-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
.list-item:last-child { border-bottom: none; }

.stats-row { display: flex; gap: 16px; margin-top: 12px; font-size: 13px; color: var(--text-secondary); }

.success-card { background: #e8f5e9; margin-top: 8px; font-size: 13px; }
.error-card { background: #ffebee; margin-top: 8px; font-size: 13px; }

.danger-btn { color: var(--danger); border-color: var(--danger); }
.form-hint { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

h4 { font-size: 13px; color: var(--text-secondary); margin: 12px 0 8px; }
.empty { text-align: center; padding: 20px; color: var(--text-secondary); font-size: 13px; }
.about-section { text-align: center; padding: 20px; cursor: pointer; }
.app-name { font-size: 18px; font-weight: 700; color: var(--primary); }
.app-version { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.app-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.dev-section { border: 1px dashed var(--accent); }
.dev-notice { background: #fff3e0; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 12px; }
.dev-info { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.dev-hint { font-size: 11px; color: var(--text-secondary); }
.dev-message { margin-top: 8px; padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px; }
.dev-message.success { background: #e8f5e9; color: var(--success); }
.dev-message.error { background: #ffebee; color: var(--danger); }
.dev-entry-hint { text-align: center; font-size: 11px; color: var(--text-secondary); margin-top: 8px; }
.form-textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; font-family: monospace; resize: vertical; background: var(--bg-card); }

/* AI Card Styles */
.ai-card { overflow: hidden; }
.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
}
.ai-header:hover { background: var(--bg-secondary, #f8f9fa); }
.ai-header-left { display: flex; align-items: center; gap: 12px; }
.ai-icon { font-size: 28px; }
.ai-title { font-size: 16px; font-weight: 600; margin: 0; }
.ai-subtitle { font-size: 12px; color: var(--text-secondary); margin: 2px 0 0; }
.ai-header-right { display: flex; align-items: center; gap: 12px; }
.ai-status {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 500;
}
.ai-status.active { background: #e8f5e9; color: #2e7d32; }
.ai-status.inactive { background: #f5f5f5; color: #757575; }
.ai-arrow { font-size: 14px; transition: transform 0.3s; }
.ai-arrow.expanded { transform: rotate(180deg); }

.ai-content { padding: 0 16px 16px; }
.ai-enable-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  margin-bottom: 16px;
}
.ai-enable-info { display: flex; flex-direction: column; }
.ai-enable-label { font-weight: 500; font-size: 14px; }
.ai-enable-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }

.ai-config-section { display: flex; flex-direction: column; gap: 16px; }
.ai-config-group {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 16px;
}
.ai-config-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ai-config-icon { font-size: 16px; }
.ai-config-title { font-size: 14px; font-weight: 600; }

.ai-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ai-form-item { display: flex; flex-direction: column; gap: 6px; }
.ai-form-item.full { grid-column: 1 / -1; }
.ai-label { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.ai-input-wrapper { position: relative; display: flex; align-items: center; }
.ai-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 6px;
  font-size: 13px;
  background: var(--bg-card, #fff);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.ai-input:focus {
  outline: none;
  border-color: var(--primary, #4caf50);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}
.ai-input::placeholder { color: #bdbdbd; }
.ai-input-hint {
  position: absolute;
  right: 12px;
  font-size: 11px;
  color: #bdbdbd;
  pointer-events: none;
}
.ai-key-toggle {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  opacity: 0.6;
}
.ai-key-toggle:hover { opacity: 1; }

/* Model Select Styles */
.model-select-wrapper { position: relative; }
.model-input { padding-right: 40px !important; }
.model-fetch-btn {
  position: absolute;
  right: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary, #4caf50);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.model-fetch-btn:hover:not(:disabled) {
  background: var(--primary-dark, #388e3c);
  transform: scale(1.05);
}
.model-fetch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.model-fetch-arrow {
  font-size: 12px;
  font-weight: bold;
}
.model-fetch-loading {
  font-size: 14px;
  animation: spin 1s linear infinite;
}

.model-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  z-index: 100;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  animation: dropdownIn 0.2s ease;
}
@keyframes dropdownIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.model-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e0e0e0);
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}
.model-dropdown-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 2px 6px;
  border-radius: 4px;
}
.model-dropdown-close:hover {
  background: var(--bg-secondary, #f5f5f5);
}
.model-dropdown-list {
  overflow-y: auto;
  max-height: 250px;
  padding: 4px;
}
.model-dropdown-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
}
.model-dropdown-item:hover {
  background: var(--bg-secondary, #f5f5f5);
}
.model-dropdown-item.active {
  background: rgba(76, 175, 80, 0.1);
  color: var(--primary, #4caf50);
  font-weight: 500;
}

.ai-action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 8px;
}
.ai-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.ai-action-btn.test-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.ai-action-btn.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.35);
}
.ai-action-btn.analyze-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}
.ai-action-btn.analyze-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(56, 239, 125, 0.35);
}
.ai-action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
.btn-loading {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-mini-result {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  animation: fadeIn 0.25s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.ai-mini-result.success { background: #e8f5e9; color: #2e7d32; }
.ai-mini-result.error { background: #ffebee; color: #c62828; }

.ai-analysis-box {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.analysis-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}
.analysis-item.warning {
  background: #fff3e0;
  border-left: 3px solid #ff9800;
}
.analysis-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: white;
}
.analysis-tag.high { background: #f44336; }
.analysis-tag.medium { background: #ff9800; }
.analysis-tag.low { background: #4caf50; }
.analysis-tag.warn { background: #ff9800; }

.ai-stats-inline {
  margin-top: 12px;
  display: flex;
  justify-content: space-around;
  padding: 10px 12px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.ai-stats-inline b {
  color: var(--primary, #4caf50);
  font-size: 15px;
}

/* Developer Options Styles */
.dev-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 4px;
}
.dev-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-secondary);
}
.dev-tab:hover {
  background: rgba(0, 0, 0, 0.04);
}
.dev-tab.active {
  background: var(--bg-card, #fff);
  color: var(--primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.dev-tab-content {
  padding: 8px 0;
}
.dev-form-section {
  margin-bottom: 16px;
}
.dev-form-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 16px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.dev-stage-card {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
.dev-stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 13px;
}
.dev-preview {
  background: #1e1e1e;
  color: #d4d4d4;
  border-radius: 8px;
  padding: 12px;
  margin: 12px 0;
  max-height: 200px;
  overflow-y: auto;
}
.dev-preview pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.dev-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.dev-actions-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.dev-knowledge-section {
  margin-bottom: 12px;
}
.dev-knowledge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.dev-knowledge-header:hover {
  background: rgba(0, 0, 0, 0.04);
}
.dev-arrow {
  transition: transform 0.3s;
}
.dev-arrow.expanded {
  transform: rotate(180deg);
}
.dev-knowledge-content {
  padding: 8px 0;
}
.dev-table {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.dev-table-header {
  display: grid;
  grid-template-columns: 1fr 120px 120px;
  padding: 10px 12px;
  background: var(--bg-secondary, #f8f9fa);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}
.dev-table-row {
  display: grid;
  grid-template-columns: 1fr 120px 120px;
  padding: 10px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--border);
  align-items: center;
}
.dev-table-row:last-child {
  border-bottom: none;
}
.dev-table-row:hover {
  background: rgba(0, 0, 0, 0.02);
}
.dev-table-col.actions {
  display: flex;
  gap: 8px;
}
.dev-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}
.dev-modal {
  background: var(--bg-card, #fff);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
.dev-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--border);
}
.dev-modal-header h4 {
  margin: 0;
  font-size: 16px;
}
.dev-modal-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}
.dev-modal-actions {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid var(--border);
  justify-content: flex-end;
}
.dev-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}
.checkbox-label input,
.radio-label input {
  margin: 0;
}
.dev-error {
  background: #ffebee;
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
}
.dev-error-title {
  color: #c62828;
  font-weight: 600;
  font-size: 13px;
}
.dev-error-suggestion {
  color: #666;
  font-size: 12px;
  margin-top: 8px;
}
.dev-import-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 8px;
  overflow: hidden;
}
.dev-import-tab {
  flex: 1;
  padding: 10px 12px;
  border: none;
  background: var(--bg-secondary, #f8f9fa);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.dev-import-tab.active {
  background: #2d7d46;
  color: white;
  font-weight: 600;
}
.dev-import-tab:not(.active):hover {
  background: #e8f5e9;
}
.dev-file-drop {
  border: 2px dashed var(--border, #e0e0e0);
  border-radius: 8px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dev-file-drop:hover {
  border-color: #2d7d46;
  background: #f1f8e9;
}
.dev-file-drop.has-file {
  border-style: solid;
  border-color: #2d7d46;
  background: #f1f8e9;
  padding: 12px 16px;
}
.dev-file-placeholder {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text-secondary, #757575);
  font-size: 13px;
}
.dev-file-hint {
  font-size: 11px;
  color: #999;
}
.dev-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.dev-file-name {
  font-weight: 500;
}
.dev-file-size {
  color: var(--text-secondary, #757575);
  font-size: 12px;
}
.dev-file-content {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.required {
  color: #f44336;
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
  color: var(--primary);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
}
.btn-icon.danger { color: var(--danger); }
.form-row {
  display: flex;
  gap: 12px;
}
.form-group.half {
  flex: 1;
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
.optional {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

/* Select with custom input */
.select-with-custom {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.select-with-custom .form-select {
  width: 100%;
}
.select-with-custom .form-input {
  width: 100%;
}

/* Condition and action rows */
.dev-condition-row,
.dev-action-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.condition-select {
  flex: 1;
  min-width: 100px;
}
.operator-select {
  width: 80px;
}
.value-input {
  flex: 1;
  min-width: 80px;
}
.action-type-select {
  width: 120px;
}
.action-msg-input {
  flex: 1;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* Developer Modal Container */
.dev-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease;
}
.dev-modal-container {
  background: var(--bg-card, #fff);
  width: 95%;
  max-width: 800px;
  height: 90vh;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
  overflow: hidden;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.dev-modal-header-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  flex-shrink: 0;
}
.dev-modal-header-bar h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.dev-modal-header-bar .dev-notice {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin: 0;
}
.dev-modal-close {
  margin-left: auto;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.dev-modal-close:hover {
  background: rgba(255, 255, 255, 0.3);
}
.dev-modal-container .dev-section {
  flex: 1;
  overflow-y: auto;
  border: none;
  margin: 0;
  border-radius: 0;
  background: transparent;
}
.dev-modal-container .card-title {
  display: none;
}
.dev-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
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
.help-content {
  padding: 4px 0;
}
.help-section {
  margin-bottom: 16px;
}
.help-section:last-child {
  margin-bottom: 0;
}
.help-section h4 {
  font-size: 15px;
  margin-bottom: 8px;
  color: var(--text);
}
.help-section p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.help-item {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.help-icon {
  font-size: 20px;
  flex-shrink: 0;
}
.help-item b {
  color: var(--text);
}
.help-tips {
  padding-left: 18px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}
</style>
