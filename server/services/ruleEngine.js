import { loadKnowledge, loadKnowledgeDir } from './knowledgeLoader.js';
import { readYaml } from './yamlUtils.js';
import path from 'path';
import { DATA_DIR, KNOWLEDGE_SYSTEM_DIR } from './paths.js';

const RISK_MODELS_PATH = path.join(KNOWLEDGE_SYSTEM_DIR, 'diseases', 'risk_models.yml');
const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

/**
 * Run the rule engine with provided context.
 * @param {object} context - { weather, crops, operations, config }
 * @returns {array} decision cards
 */
export function runRuleEngine(context) {
  const { weather, crops, operations, config } = context;
  const cards = [];

  if (!weather?.merged || !crops?.length) {
    return cards;
  }

  const weatherData = weather.merged;

  // Run decision rules
  const irrigationRules = loadKnowledge('decision_rules/irrigation_rules.yml');
  const ventilationRules = loadKnowledge('decision_rules/ventilation_rules.yml');
  const fertilizationRules = loadKnowledge('decision_rules/fertilization_rules.yml');
  const emergencyRules = loadKnowledge('decision_rules/emergency_rules.yml');

  const allRules = [
    ...(irrigationRules?.rules || []),
    ...(ventilationRules?.rules || []),
    ...(fertilizationRules?.rules || []),
    ...(emergencyRules?.rules || [])
  ];

  for (const crop of crops) {
    for (const rule of allRules) {
      if (matchRule(rule, crop, weatherData, operations)) {
        cards.push({
          id: `${rule.rule_id}_${crop.id}`,
          source: 'system',
          type: rule.action.type,
          priority: rule.action.priority,
          advice: rule.action.advice,
          conditions: rule.action.conditions,
          warnings: rule.action.warnings,
          crop: crop.name,
          variety: crop.variety_name,
          greenhouse: crop.greenhouse_name
        });
      }
    }
  }

  // Disease risk assessment
  const riskModels = readYaml(RISK_MODELS_PATH);
  if (riskModels?.models && crops.length > 0) {
    const riskResults = assessDiseaseRisk(riskModels.models, crops, weatherData);
    for (const risk of riskResults) {
      if (risk.level !== '低') {
        cards.push({
          id: `disease_risk_${risk.disease}`,
          source: 'system',
          type: '病害风险',
          priority: risk.level === '高' ? '紧急' : '重要',
          advice: `${risk.disease}风险${risk.level}，${risk.level === '高' ? '建议立即预防性施药' : '加强监测，准备药剂'}`,
          conditions: [risk.reason],
          warnings: [risk.prevention],
          crop: risk.crop,
          disease: risk.disease,
          riskLevel: risk.level
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder = { '紧急': 0, '高': 1, '重要': 2, '常规': 3, '低': 4 };
  cards.sort((a, b) => (priorityOrder[a.priority] ?? 5) - (priorityOrder[b.priority] ?? 5));

  return cards;
}

/**
 * Check if a rule's trigger conditions match current context.
 */
function matchRule(rule, crop, weather, operations) {
  const trigger = rule.trigger;
  if (!trigger) return false;

  // Check crop stage
  if (trigger.crop_stage && trigger.crop_stage.length > 0) {
    if (!trigger.crop_stage.includes(crop.current_stage)) return false;
  }

  // Check weather conditions
  if (trigger.weather) {
    const tw = trigger.weather;
    if (!weather) return false;

    if (tw.temperature_max) {
      const tempMax = weather.temperature_max ?? weather.temperature?.max;
      if (tempMax == null) return false;
      if (tw.temperature_max.min != null && tempMax < tw.temperature_max.min) return false;
      if (tw.temperature_max.max != null && tempMax > tw.temperature_max.max) return false;
    }

    if (tw.temperature_min) {
      const tempMin = weather.temperature_min ?? weather.temperature?.min;
      if (tempMin == null) return false;
      if (tw.temperature_min.max != null && tempMin > tw.temperature_min.max) return false;
      if (tw.temperature_min.min != null && tempMin < tw.temperature_min.min) return false;
    }

    if (tw.precipitation_next_48h) {
      const precip = weather.precipitation_next_48h ?? 0;
      if (tw.precipitation_next_48h.min != null && precip < tw.precipitation_next_48h.min) return false;
      if (tw.precipitation_next_48h.max != null && precip > tw.precipitation_next_48h.max) return false;
    }

    if (tw.precipitation_next_24h) {
      const precip = weather.precipitation_next_24h ?? 0;
      if (tw.precipitation_next_24h.min != null && precip < tw.precipitation_next_24h.min) return false;
    }

    if (tw.humidity_avg) {
      const humidity = weather.humidity ?? weather.humidity_avg;
      if (humidity == null) return false;
      if (tw.humidity_avg.min != null && humidity < tw.humidity_avg.min) return false;
      if (tw.humidity_avg.max != null && humidity > tw.humidity_avg.max) return false;
    }

    if (tw.wind_speed_max) {
      const wind = weather.wind_speed_max ?? weather.wind_speed;
      if (wind == null) return false;
      if (tw.wind_speed_max.min != null && wind < tw.wind_speed_max.min) return false;
    }
  }

  // Check days after transplant
  if (trigger.days_after_transplant) {
    const days = crop.days_after_transplant ?? 0;
    if (trigger.days_after_transplant.min != null && days < trigger.days_after_transplant.min) return false;
  }

  return true;
}

/**
 * Assess disease risk based on weather and risk models.
 */
function assessDiseaseRisk(models, crops, weather) {
  const results = [];

  if (!weather) return results;

  const tempMax = weather.temperature_max ?? weather.temperature?.max ?? 0;
  const tempMin = weather.temperature_min ?? weather.temperature?.min ?? 0;
  const avgTemp = (tempMax + tempMin) / 2;
  const humidity = weather.humidity ?? weather.humidity_avg ?? 0;
  const rainDays = weather.rain_days ?? weather.precipitation_days ?? 0;

  for (const crop of crops) {
    const cropType = crop.type || crop.crop_type;
    for (const [key, model] of Object.entries(models)) {
      if (model.crop !== cropType) continue;

      // Check if crop has this disease
      const cropData = loadKnowledge(`crops/${cropType}.yml`);
      if (!cropData?.diseases?.includes(model.disease)) continue;

      const level = calculateRiskLevel(model, avgTemp, humidity, rainDays);
      if (level === '低') continue;

      const diseaseData = loadKnowledge(`diseases/${cropType}/${model.disease}.yml`);
      results.push({
        crop: cropType,
        disease: model.disease,
        level,
        reason: buildRiskReason(model, avgTemp, humidity, rainDays, level),
        prevention: diseaseData?.agricultural_control?.[0] || '加强监测'
      });
    }
  }

  return results;
}

function calculateRiskLevel(model, temp, humidity, rainDays) {
  const rf = model.risk_factors;
  if (!rf) return '低';

  // High risk
  if (rf.high) {
    const h = rf.high;
    if (temp >= (h.temp?.[0] ?? 0) && temp <= (h.temp?.[1] ?? 999) &&
        humidity >= (h.humidity?.[0] ?? 0) && humidity <= (h.humidity?.[1] ?? 100) &&
        rainDays >= (h.rain_days ?? 0)) {
      return '高';
    }
  }

  // Medium risk
  if (rf.medium) {
    const m = rf.medium;
    if (temp >= (m.temp?.[0] ?? 0) && temp <= (m.temp?.[1] ?? 999) &&
        humidity >= (m.humidity?.[0] ?? 0) && humidity <= (m.humidity?.[1] ?? 100) &&
        rainDays >= (m.rain_days ?? 0)) {
      return '中';
    }
  }

  return '低';
}

function buildRiskReason(model, temp, humidity, rainDays, level) {
  const parts = [];
  if (model.temp_range) parts.push(`温度${temp.toFixed(0)}°C（适温${model.temp_range[0]}-${model.temp_range[1]}°C）`);
  if (humidity > 0) parts.push(`湿度${humidity}%`);
  if (rainDays > 0) parts.push(`近期${rainDays}天有雨`);
  return parts.join('，') || `${level}风险条件满足`;
}
