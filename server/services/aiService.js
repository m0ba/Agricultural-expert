/**
 * AI Service - Handles AI operations including RAG, prompt assembly, and structured output
 */
import { readYaml, writeYaml } from './yamlUtils.js';
import { loadKnowledge, loadKnowledgeDir } from './knowledgeLoader.js';
import { runRuleEngine } from './ruleEngine.js';
import { getCurrentWeather, getWeatherHistory, getWeatherSummary } from './weatherService.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const USAGE_PATH = path.join(__dirname, '..', 'data', 'ai_usage.yml');
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.yml');

const SYSTEM_PROMPT = `你是设施蔬菜种植专家。根据以下数据，为【每个品种】分别给出今日的农事建议。
数据中标注了[作物1]、[作物2]等编号，你必须为每个作物编号分别输出独立的分析结果。
规则：
1. 建议必须基于提供的数据，不编造
2. 每条建议给出具体操作（用量、时间、方法）
3. 数据不足的字段不要猜测，跳过
4. 涉及农药时必须考虑安全间隔和禁忌条件
5. 不同品种的建议必须独立，不要混淆
6. 输出严格遵循以下JSON格式，不要输出任何其他内容：

{
  "crop_analyses": [
    {
      "crop_index": 0,
      "operation_advice": {
        "title": "今日操作建议",
        "priority": "高/中/低",
        "summary": "该品种的一句话摘要",
        "actions": ["具体操作1", "具体操作2"],
        "reason": "判断依据"
      },
      "risk_warning": {
        "title": "风险警示",
        "level": "高/中/低",
        "summary": "该品种的风险摘要",
        "actions": ["建议措施"],
        "trigger": "触发条件"
      },
      "safety_alert": {
        "title": "安全提醒",
        "alerts": ["提醒1", "提醒2"]
      }
    }
  ]
}
注意：crop_index 对应数据中[作物N]的N-1（即[作物1]的crop_index为0，[作物2]为1，以此类推）。`;

/**
 * RAG retrieval - gather relevant knowledge for current context
 */
function ragRetrieve(crop) {
  const parts = [];

  if (!crop) return parts;

  // 1. Crop stage management points
  const cropData = loadKnowledge(`crops/${crop.type}.yml`);
  if (cropData) {
    const stage = cropData.stages?.find(s => s.name === crop.current_stage);
    if (stage) {
      parts.push(`【${crop.type} ${crop.current_stage}】${stage.description}。要点：${stage.key_points?.join('；') || '无'}`);
    }
  }

  // 2. Family common knowledge
  if (cropData?.family) {
    const family = loadKnowledge(`taxonomy/${cropData.family}.yml`);
    if (family) {
      parts.push(`【${family.family}科共性】${family.management_points?.join('；') || ''}`);
    }
  }

  // 3. Disease risk data
  if (cropData?.diseases) {
    parts.push(`【易感病害】${cropData.diseases.join('、')}`);
  }

  return parts;
}

/**
 * Build full context for AI analysis
 * Returns { context: string, crops: Array } where crops is the active crops list
 */
async function buildContext(contextData) {
  const config = readYaml(CONFIG_PATH) || {};
  const weather = await getCurrentWeather();
  const history = await getWeatherHistory(7);
  const operations = readYaml(path.join(__dirname, '..', 'data', 'operations.yml')) || [];

  const activeCrops = (config.crops || []).filter(c => c.status === 'active');

  const weatherSummary = getWeatherSummary(weather, history);

  const historySummary = history
    .filter(h => h.status !== '无数据')
    .map(h => `${h.date}: ${h.temperature_min}-${h.temperature_max}°C, 湿度${h.humidity_avg}%`)
    .join('\n') || '无历史天气数据';

  const recentOps = operations
    .filter(o => {
      const daysDiff = Math.floor((Date.now() - new Date(o.date).getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    })
    .map(o => `${o.date} ${o.type}: ${o.crop_name}${o.note ? ' - ' + o.note : ''}`)
    .join('\n') || '无近期操作记录';

  const ragParts = [];
  for (const crop of activeCrops) {
    ragParts.push(...ragRetrieve(crop));
  }

  const ruleResults = runRuleEngine({ weather, crops: activeCrops, operations, config });
  const ruleSummary = ruleResults.map(r => `[${r.priority}] ${r.advice}`).join('\n') || '无系统建议';

  const parts = [`【天气概况】${weatherSummary}`];
  parts.push(`\n【近7天天气趋势】\n${historySummary}`);

  activeCrops.forEach((crop, idx) => {
    parts.push(`\n【种植情况 [作物${idx + 1}]】${crop.type} ${crop.variety_name || ''} - ${crop.greenhouse_name || ''}，${crop.current_stage}，定植${crop.days_after_transplant ?? '未知'}天`);
    if (crop.stage_detail) {
      const synced = { ...crop.stage_detail };
      if ('定植天数' in synced && crop.days_after_transplant != null) {
        synced['定植天数'] = crop.days_after_transplant;
      }
      const details = Object.entries(synced).map(([k, v]) => `${k}:${v}`).join('，');
      if (details) parts.push(`阶段详情：${details}`);
    }
    if (crop.quantity) parts.push(`种植数量：${crop.quantity}株`);
  });

  if (config.cultivation_method) parts.push(`\n【栽培条件】${config.cultivation_method}`);
  if (config.substrate?.type) parts.push(`基质：${config.substrate.type}`);
  if (config.water_fertilizer?.enabled) parts.push(`水肥一体化：${config.water_fertilizer.enabled}`);

  parts.push(`\n【近期操作】${recentOps}`);
  parts.push(`\n【规则引擎建议】${ruleSummary}`);
  if (ragParts.length > 0) parts.push(`\n【相关知识】${ragParts.join('\n')}`);
  if (config.history) {
    const h = config.history;
    const diseases = Array.isArray(h.diseases) ? h.diseases.join('、') : (h.diseases || '无');
    const problems = Array.isArray(h.problems) ? h.problems.join('、') : (h.problems || '无');
    parts.push(`\n【历史问题】上年病害：${diseases}，最大损失：${h.max_loss || '无'}，痛点：${problems}`);
  }

  return { context: parts.join('\n'), crops: activeCrops };
}

/**
 * Call AI API with structured output
 */
async function callAI(aiConfig, messages, maxTokens = 4000) {
  const response = await fetch(`${aiConfig.api_base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.api_key}`
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens
    }),
    signal: AbortSignal.timeout(210000)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';

  try {
    let jsonStr = content;
    // Remove <think>...</think> tags if present (Qwen3)
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Extract from markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    // Find JSON object
    if (!jsonStr.startsWith('{')) {
      const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
    }
    return JSON.parse(jsonStr);
  } catch (parseErr) {
    console.error('AI response parse error:', parseErr.message, 'Content:', content.substring(0, 500));
    throw new Error('AI 返回格式错误，请重试');
  }
}

/**
 * Smart analysis - one-click daily analysis, per-crop
 * Returns { result, crops }
 */
export async function analyzeWithAI(aiConfig, contextData) {
  const { context, crops } = await buildContext(contextData);

  console.log(`[AI] Context built for ${crops.length} crops:`);
  crops.forEach((c, i) => {
    const syncedDays = c.stage_detail?.['定植天数'];
    const fixedDays = (syncedDays != null && c.days_after_transplant != null) ? c.days_after_transplant : syncedDays;
    console.log(`  [作物${i + 1}] ${c.type}·${c.variety_name} (${c.greenhouse_name}) days=${c.days_after_transplant} stage_detail定植天数: ${syncedDays} → ${fixedDays}`);
  });
  console.log(`[AI] Context length: ${context.length} chars`);
  const cropSections = context.match(/\[作物\d+\]/g);
  console.log(`[AI] Crop sections in context: ${cropSections?.join(', ') || 'NONE'}`);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: context }
  ];

  const rawResult = await callAI(aiConfig, messages);

  console.log(`[AI] Raw result has crop_analyses: ${Array.isArray(rawResult?.crop_analyses)}, count: ${rawResult?.crop_analyses?.length || 0}`);
  if (rawResult?.crop_analyses) {
    rawResult.crop_analyses.forEach((item, i) => {
      console.log(`  [AI回复${i + 1}] crop_index=${item.crop_index} priority=${item.operation_advice?.priority} summary="${item.operation_advice?.summary?.substring(0, 30)}..."`);
    });
  }

  const result = normalizeAnalysisResult(rawResult, crops);

  return { result, crops };
}

/**
 * Normalize AI result to ensure crop_analyses array format
 * Handles both new per-crop format and legacy single-object format
 */
function normalizeAnalysisResult(raw, crops) {
  if (raw?.crop_analyses && Array.isArray(raw.crop_analyses)) {
    raw.crop_analyses.forEach((item, idx) => {
      if (item.crop_index != null && crops[item.crop_index]) {
        const c = crops[item.crop_index];
        item.crop_id = c.id;
        item.crop_type = c.type;
        item.variety_name = c.variety_name;
        item.greenhouse_name = c.greenhouse_name;
      }
    });
    return raw;
  }

  if (raw?.operation_advice || raw?.risk_warning) {
    const analyses = crops.map((c, idx) => ({
      crop_index: idx,
      crop_id: c.id,
      crop_type: c.type,
      variety_name: c.variety_name,
      greenhouse_name: c.greenhouse_name,
      operation_advice: raw.operation_advice || null,
      risk_warning: raw.risk_warning || null,
      safety_alert: raw.safety_alert || null
    }));
    return { crop_analyses: analyses };
  }

  return { crop_analyses: crops.map((c, idx) => ({
    crop_index: idx,
    crop_id: c.id,
    crop_type: c.type,
    variety_name: c.variety_name,
    greenhouse_name: c.greenhouse_name,
    operation_advice: { title: '今日操作建议', priority: '中', summary: '分析结果解析异常，请重试', actions: [], reason: '' },
    risk_warning: null,
    safety_alert: null
  })) };
}

const PLANTING_PLAN_PROMPT = `你是设施蔬菜种植专家。根据提供的作物特性、生长阶段、环境条件和天气数据，为种植新手生成一份详细、实用的全生育期种植计划。
规则：
1. 所有建议必须基于提供的数据和作物知识，不编造
2. 每条操作给出具体方法（用量、时间、频率）
3. 日期计算基于定植日期和各阶段典型天数
4. 倒计时提醒必须精确到天数，使用当前日期计算
5. 涉及农药时必须考虑安全间隔和禁忌条件
6. 面向种植新手，语言通俗易懂
7. 输出严格遵循以下JSON格式，不要输出任何其他内容：

{
  "overview": {
    "crop": "作物名·品种名",
    "planting_date": "YYYY-MM-DD",
    "current_stage": "当前阶段名",
    "days_after_planting": 已定植天数,
    "total_days": 全生育期总天数,
    "days_remaining": 剩余天数,
    "expected_harvest": "YYYY-MM-DD预计采收日期",
    "current_day_in_stage": "第X天/共Y天",
    "overall_progress": "X%"
  },
  "upcoming_events": [
    {
      "days_until": 还有几天,
      "event": "事件名称（如：进入初花期、第一穗花开放）",
      "action": "需要准备或执行的操作",
      "icon": "对应emoji图标",
      "urgency": "即将/临近/规划/远期"
    }
  ],
  "milestones": [
    {
      "stage": "阶段名称",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "duration": "X天",
      "status": "已完成/进行中/未开始",
      "current_day": 当前是第几天(仅进行中的阶段),
      "key_event": "该阶段关键事件"
    }
  ],
  "environment_advice": {
    "current_weather": {
      "temperature": "当前温度",
      "humidity": "当前湿度",
      "weather_desc": "天气描述",
      "forecast_7days": "未来7天天气趋势及建议"
    },
    "greenhouse_control": {
      "temperature": {
        "target_day": "白天目标温度",
        "target_night": "夜间目标温度",
        "current": "当前温度",
        "status": "偏高/正常/偏低",
        "action": "具体调控措施"
      },
      "ventilation": {
        "status": "需要加强/正常/需要减少",
        "reason": "原因",
        "action": "具体通风操作（时间、方式）"
      },
      "watering": {
        "status": "需要浇水/正常/需要控水",
        "reason": "原因",
        "action": "具体浇水方案（时间、方式、水量）"
      },
      "humidity": {
        "current": "当前湿度",
        "target": "目标湿度范围",
        "status": "偏高/正常/偏低",
        "action": "调控措施"
      }
    }
  },
  "current_stage_guide": {
    "stage_name": "当前阶段名称",
    "day_in_stage": 当前阶段第几天,
    "total_days_in_stage": 当前阶段总天数,
    "days_remaining_in_stage": 当前阶段剩余天数,
    "today_tasks": [
      {
        "task": "任务名称",
        "time": "建议时间",
        "method": "具体操作方法",
        "importance": "必须/重要/建议",
        "icon": "emoji图标"
      }
    ],
    "this_week_tasks": ["本周任务列表"],
    "watch_points": ["注意事项和常见问题"]
  },
  "next_stage_preview": {
    "stage_name": "下一阶段名称",
    "expected_start": "YYYY-MM-DD",
    "days_until": 还有几天,
    "key_events": ["关键事件"],
    "preparation": ["准备工作"],
    "pollination_guide": {
      "method": "授粉方式（人工/熊蜂/自花授粉）",
      "best_time": "最佳授粉时间",
      "frequency": "授粉频率",
      "tips": ["授粉技巧"]
    }
  },
  "pest_disease_calendar": {
    "current_risk": [
      {
        "name": "病虫害名称",
        "risk_level": "高/中/低",
        "high_risk_period": "高风险期",
        "days_until_high_risk_end": 距离高风险期结束天数,
        "symptoms": "症状描述",
        "prevention": ["预防措施"],
        "treatment": "治疗方法"
      }
    ],
    "upcoming_risks": [
      {
        "name": "病虫害名称",
        "high_risk_start": "高风险开始阶段",
        "days_until": 还有几天进入高风险期,
        "trigger": "触发条件",
        "prevention": ["预防措施"]
      }
    ],
    "prevention_calendar": [
      {
        "date": "YYYY-MM-DD",
        "days_until": 还有几天,
        "action": "防治操作",
        "icon": "emoji图标"
      }
    ]
  },
  "risk_alerts": [
    {
      "risk": "风险名称",
      "probability": "高/中/低",
      "trigger": "触发条件",
      "impact": "影响说明",
      "prevention": ["预防措施"]
    }
  ]
}`;

/**
 * Generate planting plan
 */
export async function generatePlan(aiConfig, planData) {
  const { crop_type, variety_name, city, planting_date, current_stage, greenhouse_info, cultivation, history } = planData;

  const weather = await getCurrentWeather();
  const weatherHistory = await getWeatherHistory(7);
  const weatherSummary = getWeatherSummary(weather, weatherHistory);

  const cropKnowledge = loadKnowledge(`crops/${crop_type}.yml`);
  let knowledgeContext = '';
  if (cropKnowledge) {
    const stageInfo = (cropKnowledge.stages || []).map(s => {
      return `  - ${s.name}(第${s.order}阶段, ${s.typical_days}天): ${s.description}。要点: ${(s.key_points || []).join('；')}。温度: 白天${s.temperature?.day || '-'}, 夜间${s.temperature?.night || '-'}。浇水: ${s.watering || '-'}。施肥: ${s.fertilization || '-'}。注意病虫害: ${(s.pest_watch || []).join('、')}`;
    }).join('\n');
    knowledgeContext = `\n\n作物知识库 (${crop_type}):\n全生育期: ${cropKnowledge.total_days || '未知'}天\n易感病害: ${(cropKnowledge.diseases || []).join('、')}\n\n各阶段详情:\n${stageInfo}`;
  }

  const riskModels = loadKnowledge('diseases/risk_models.yml');
  let riskContext = '';
  if (riskModels?.models) {
    const cropRisks = Object.entries(riskModels.models)
      .filter(([key]) => key.startsWith(crop_type))
      .map(([, m]) => `${m.disease}: 适宜温度${m.temp_range?.[0]}-${m.temp_range?.[1]}°C, 湿度阈值${m.humidity_threshold}%`);
    if (cropRisks.length > 0) {
      riskContext = `\n\n病害风险模型:\n${cropRisks.join('\n')}`;
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `请为以下作物生成一份详细的全生育期种植计划（面向种植新手）：

当前日期: ${today}
作物: ${crop_type} ${variety_name || ''}
地点: ${city || '未知'}
定植日期: ${planting_date}
当前阶段: ${current_stage}
已定植天数: ${planData.days_after_transplant || '未知'}天
棚区信息: ${JSON.stringify(greenhouse_info || {})}
栽培条件: ${JSON.stringify(cultivation || {})}
近期天气: ${weatherSummary}
${history ? `历史问题: ${JSON.stringify(history)}` : ''}${knowledgeContext}${riskContext}

请根据以上数据，生成一份详细的种植计划。要求：
1. 计算各阶段的起止日期（基于定植日期和各阶段典型天数）
2. 根据当前天气给出具体的温度、通风、浇水建议
3. 列出即将到来的事件和倒计时天数
4. 给出当前阶段每天的具体操作任务
5. 预告下一阶段的准备工作（如授粉技巧）
6. 列出当前和即将到来的病虫害风险及防治日历
7. 所有日期使用YYYY-MM-DD格式`;

  const messages = [
    { role: 'system', content: PLANTING_PLAN_PROMPT },
    { role: 'user', content: prompt }
  ];

  const result = await callAI(aiConfig, messages, 8000);

  const config = readYaml(CONFIG_PATH) || {};
  const cropIdx = (config.crops || []).findIndex(c => c.type === crop_type && c.variety_name === variety_name);
  if (cropIdx !== -1) {
    config.crops[cropIdx].planting_plan = result;
    writeYaml(CONFIG_PATH, config);
  }

  return result;
}

/**
 * Reset daily AI usage
 */
export async function resetDailyUsage() {
  const usage = readYaml(USAGE_PATH) || {};
  const today = new Date().toISOString().slice(0, 10);
  usage.date = today;
  usage.analyze_count = 0;
  usage.analyze_last_time = null;
  usage.plan_count = 0;
  usage.plan_last_time = null;
  writeYaml(USAGE_PATH, usage);
}

const GROWTH_PREDICTION_PROMPT = `你是设施蔬菜种植专家。根据提供的作物生长数据，分析当前生长状态并给出预测。
规则：
1. 基于实际数据进行分析，不编造
2. 考虑当前阶段、生长天数、环境条件等因素
3. 给出客观的生长状态评估和风险提示
4. 输出严格遵循以下JSON格式：

{
  "status": "生长状态简短描述（如：生长良好/需关注/生长缓慢）",
  "summary": "详细分析（2-3句话，包含当前阶段表现、是否正常、需要注意什么）",
  "risk_level": "low/medium/high",
  "recommendations": ["建议1", "建议2"],
  "next_milestone": "下一阶段的预期表现或目标"
}`;

/**
 * Predict crop growth status using AI
 */
export async function predictGrowth(aiConfig, predictionData) {
  const { crop_type, variety_name, current_stage, days_after_transplant, latest_record, weather } = predictionData;

  const contextParts = [];

  contextParts.push(`作物类型：${crop_type}`);
  if (variety_name) contextParts.push(`品种：${variety_name}`);
  contextParts.push(`当前阶段：${current_stage}`);
  contextParts.push(`定植后天数：${days_after_transplant || 0}天`);

  if (latest_record && Object.keys(latest_record).length > 0) {
    const recordStr = Object.entries(latest_record)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join('，');
    if (recordStr) contextParts.push(`最新生长记录：${recordStr}`);
  }

  if (weather) {
    const weatherInfo = [];
    if (weather.temperature) weatherInfo.push(`温度${weather.temperature}°C`);
    if (weather.humidity) weatherInfo.push(`湿度${weather.humidity}%`);
    if (weather.weather_desc) weatherInfo.push(`${weather.weather_desc}`);
    if (weatherInfo.length > 0) contextParts.push(`当前天气：${weatherInfo.join('，')}`);
  }

  const userPrompt = `请分析以下作物的生长状态：\n\n${contextParts.join('\n')}`;

  const messages = [
    { role: 'system', content: GROWTH_PREDICTION_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  return await callAI(aiConfig, messages);
}
