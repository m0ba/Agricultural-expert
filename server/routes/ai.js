import { Router } from 'express';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import path from 'path';
import { DATA_DIR } from '../services/paths.js';

const USAGE_PATH = path.join(DATA_DIR, 'ai_usage.yml');
const RESULTS_PATH = path.join(DATA_DIR, 'ai_results.yml');
const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between requests

function getUsage() { return readYaml(USAGE_PATH) || {}; }
function saveUsage(u) { return writeYaml(USAGE_PATH, u); }
function getConfig() { return readYaml(CONFIG_PATH) || {}; }
function getResults() { return readYaml(RESULTS_PATH) || {}; }
function saveResults(r) { return writeYaml(RESULTS_PATH, r); }

const router = Router();

// POST /api/ai/analyze - Smart analysis
router.post('/analyze', async (req, res) => {
  const config = getConfig();
  if (!config.ai?.enabled) return res.status(400).json({ error: 'AI 未启用' });
  if (!config.ai?.api_base || !config.ai?.api_key || !config.ai?.model) {
    return res.status(400).json({ error: 'AI 配置不完整' });
  }

  const usage = getUsage();
  const now = Date.now();

  // Cooldown check (1 minute between requests)
  if (usage.analyze_last_time) {
    const elapsed = now - new Date(usage.analyze_last_time).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({
        error: `${remainingSec}秒后再试`,
        cooldown: remainingSec,
        remaining: 0
      });
    }
  }

  try {
    const { analyzeWithAI } = await import('../services/aiService.js');
    const { result, crops } = await analyzeWithAI(config.ai, req.body.context || {});
    usage.analyze_count = (usage.analyze_count || 0) + 1;
    usage.analyze_last_time = new Date().toISOString();
    usage.date = new Date().toISOString().slice(0, 10);
    usage.total_analyze_month = (usage.total_analyze_month || 0) + 1;
    saveUsage(usage);
    res.json({ result, crops, cooldown: COOLDOWN_MS / 1000, remaining: -1 });
  } catch (err) {
    const errorMsg = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? 'AI 分析超时（210秒），请稍后重试'
      : 'AI 分析失败: ' + err.message;
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/ai/plan - Generate planting plan
router.post('/plan', async (req, res) => {
  const config = getConfig();
  if (!config.ai?.enabled) return res.status(400).json({ error: 'AI 未启用' });

  const usage = getUsage();
  const now = Date.now();
  const cropId = req.body.crop_id || 'default';

  // Per-crop cooldown check
  if (!usage.plan_cooldowns) usage.plan_cooldowns = {};
  const lastTime = usage.plan_cooldowns[cropId];
  if (lastTime) {
    const elapsed = now - new Date(lastTime).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({ error: `该品种冷却中，${remainingSec}秒后再试`, cooldown: remainingSec });
    }
  }

  try {
    const { generatePlan } = await import('../services/aiService.js');
    const result = await generatePlan(config.ai, req.body);
    usage.plan_count = (usage.plan_count || 0) + 1;
    if (!usage.plan_cooldowns) usage.plan_cooldowns = {};
    usage.plan_cooldowns[cropId] = new Date().toISOString();
    usage.date = new Date().toISOString().slice(0, 10);
    usage.total_plan_month = (usage.total_plan_month || 0) + 1;
    saveUsage(usage);
    res.json({ result });
  } catch (err) {
    const errorMsg = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? '种植计划生成超时，请稍后重试'
      : '种植计划生成失败: ' + err.message;
    res.status(500).json({ error: errorMsg });
  }
});

// POST /api/ai/test - Test AI connection
router.post('/test', async (req, res) => {
  const { api_base, api_key, model } = req.body;
  if (!api_base) return res.status(400).json({ error: '请填写接口地址' });
  if (!api_key) return res.status(400).json({ error: '请填写 API 密钥' });
  if (!model) return res.status(400).json({ error: '请填写模型名称' });

  try {
    const startTime = Date.now();
    const response = await fetch(`${api_base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: '你好' }], max_tokens: 20 }),
      signal: AbortSignal.timeout(150000)
    });
    const elapsed = Date.now() - startTime;
    if (!response.ok) {
      if (response.status === 401) return res.status(401).json({ error: 'API Key 无效', status: 401 });
      if (response.status === 404) return res.status(404).json({ error: '模型名称错误或不存在', status: 404 });
      if (response.status === 429) return res.status(429).json({ error: '请求频率超限', status: 429 });
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errData.error?.message || `HTTP ${response.status}` });
    }
    const data = await response.json();
    // Auto-save AI config on successful test
    try {
      const config = getConfig();
      config.ai = { ...config.ai, api_base, api_key, model, enabled: true };
      writeYaml(CONFIG_PATH, config);
    } catch (saveErr) {
      console.error('[AI Test] Auto-save failed:', saveErr.message);
    }
    res.json({ success: true, model: data.model || model, responseTime: elapsed, reply: data.choices?.[0]?.message?.content || '' });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return res.status(408).json({ error: '连接超时（210秒）' });
    return res.status(502).json({ error: '无法连接，请检查网络或接口地址' });
  }
});

// GET /api/ai/models - Fetch available models from API
router.get('/models', async (req, res) => {
  const config = getConfig();
  const api_base = config.ai?.api_base;
  const api_key = config.ai?.api_key;

  if (!api_base || !api_key) {
    return res.status(400).json({ error: '请先配置接口地址和API密钥' });
  }

  try {
    const response = await fetch(`${api_base.replace(/\/$/, '')}/models`, {
      headers: { 'Authorization': `Bearer ${api_key}` },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: errData.error?.message || `HTTP ${response.status}` });
    }

    const data = await response.json();
    let models = [];

    if (Array.isArray(data.data)) {
      models = data.data
        .map(m => m.id || m.name)
        .filter(Boolean)
        .sort();
    } else if (Array.isArray(data)) {
      models = data
        .map(m => m.id || m.name || m)
        .filter(Boolean)
        .sort();
    }

    res.json({ success: true, models });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(408).json({ error: '获取模型列表超时' });
    }
    return res.status(502).json({ error: '无法连接，请检查接口地址' });
  }
});

// GET /api/ai/usage
router.get('/usage', (req, res) => {
  const usage = getUsage();
  let cooldown_remaining = 0;
  if (usage.analyze_last_time) {
    const elapsed = Date.now() - new Date(usage.analyze_last_time).getTime();
    cooldown_remaining = Math.max(0, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
  }
  res.json({
    analyze_count: usage.analyze_count || 0,
    analyze_remaining: -1,
    plan_count: usage.plan_count || 0,
    plan_remaining: -1,
    total_analyze_month: usage.total_analyze_month || 0,
    total_plan_month: usage.total_plan_month || 0,
    estimated_tokens: usage.estimated_tokens || 0,
    cooldown_remaining
  });
});

// GET /api/ai/results - Get stored AI results (analysis + plan)
router.get('/results', (req, res) => {
  const results = getResults();
  res.json(results);
});

// POST /api/ai/results/analysis - Save analysis result
router.post('/results/analysis', (req, res) => {
  const results = getResults();
  results.last_analysis = {
    data: req.body.result,
    timestamp: new Date().toISOString()
  };
  saveResults(results);
  res.json({ success: true });
});

// POST /api/ai/results/plan - Save plan result (per crop)
router.post('/results/plan', (req, res) => {
  const { result, crop_id } = req.body;
  const results = getResults();
  if (!results.planting_plans) results.planting_plans = {};
  const entry = { data: result, timestamp: new Date().toISOString() };
  if (crop_id) {
    results.planting_plans[crop_id] = entry;
  }
  results.last_plan = entry;
  saveResults(results);
  res.json({ success: true });
});

// POST /api/ai/predict-growth - AI growth prediction (once per day per crop)
router.post('/predict-growth', async (req, res) => {
  const config = getConfig();
  if (!config.ai?.enabled) return res.status(400).json({ error: 'AI 未启用' });
  if (!config.ai?.api_base || !config.ai?.api_key || !config.ai?.model) {
    return res.status(400).json({ error: 'AI 配置不完整' });
  }

  const { crop_id } = req.body;
  if (!crop_id) return res.status(400).json({ error: '缺少作物ID' });

  const results = getResults();
  const today = new Date().toISOString().slice(0, 10);

  // Check if already predicted today for this crop
  const predictions = results.growth_predictions || {};
  if (predictions[crop_id]?.date === today) {
    return res.json({
      prediction: predictions[crop_id].data,
      cached: true,
      message: '今日已更新'
    });
  }

  try {
    const { predictGrowth } = await import('../services/aiService.js');
    const prediction = await predictGrowth(config.ai, req.body);

    // Save prediction with date stamp
    if (!results.growth_predictions) results.growth_predictions = {};
    results.growth_predictions[crop_id] = {
      data: prediction,
      date: today,
      timestamp: new Date().toISOString()
    };
    saveResults(results);

    // Update usage stats
    const usage = getUsage();
    usage.predict_count = (usage.predict_count || 0) + 1;
    usage.predict_last_time = new Date().toISOString();
    saveUsage(usage);

    res.json({ prediction, cached: false });
  } catch (err) {
    const errorMsg = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? '生长预测超时（210秒），请稍后重试'
      : '生长预测失败: ' + err.message;
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
