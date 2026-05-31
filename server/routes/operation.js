import { Router } from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import { stringify } from 'csv-stringify/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.yml');
const OPERATIONS_PATH = path.join(__dirname, '..', 'data', 'operations.yml');

function getOperations() { return readYaml(OPERATIONS_PATH) || []; }
function saveOperations(ops) { return writeYaml(OPERATIONS_PATH, ops); }
function getConfig() { return readYaml(CONFIG_PATH) || {}; }
function saveConfig(config) { return writeYaml(CONFIG_PATH, config); }

const VALID_TYPES = ['施肥', '打药', '灌溉', '整枝打杈', '通风', '授粉', '采收', '环境记录', '其他'];

const router = Router();

// GET /api/operations
router.get('/', (req, res) => {
  let ops = getOperations();
  if (req.query.type) ops = ops.filter(o => o.type === req.query.type);
  if (req.query.crop_id) ops = ops.filter(o => o.crop_id === req.query.crop_id);
  if (req.query.greenhouse_id) ops = ops.filter(o => o.greenhouse_id === req.query.greenhouse_id);
  if (req.query.start_date) ops = ops.filter(o => o.date >= req.query.start_date);
  if (req.query.end_date) ops = ops.filter(o => o.date <= req.query.end_date);
  if (req.query.limit) ops = ops.slice(0, parseInt(req.query.limit));
  // Sort by date descending
  ops.sort((a, b) => b.date.localeCompare(a.date));
  res.json(ops);
});

// POST /api/operations
router.post('/', (req, res) => {
  const { type, date, crop_id, greenhouse_id, details, note } = req.body;

  // Validation
  if (!type) return res.status(400).json({ error: '请选择操作类型' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: '无效的操作类型' });
  if (!date) return res.status(400).json({ error: '请选择日期' });
  if (!crop_id) return res.status(400).json({ error: '请选择作物' });

  // Conditional required fields
  if (type === '打药' && !details?.pesticide_name) return res.status(400).json({ error: '打药操作需选择农药名称' });
  if (type === '施肥' && !details?.fertilizer_name) return res.status(400).json({ error: '施肥操作需选择肥料名称' });
  if (type === '采收' && (!details?.weight || details.weight <= 0)) return res.status(400).json({ error: '采收操作需填写采收重量' });

  // Validate note length
  if (note && note.length > 50) return res.status(400).json({ error: '备注最多50字' });

  const config = getConfig();
  const crop = (config.crops || []).find(c => c.id === crop_id);
  const greenhouse = (config.greenhouses || []).find(g => g.id === greenhouse_id);

  const operation = {
    id: uuidv4(),
    type,
    date,
    crop_id,
    crop_name: crop ? `${crop.type} ${crop.variety_name}` : '未知作物',
    greenhouse_id: greenhouse_id || crop?.greenhouse_id,
    greenhouse_name: greenhouse?.name || crop?.greenhouse_name || '未知棚区',
    details: details || {},
    note: note || '',
    safety_interval: null,
    created_at: new Date().toISOString()
  };

  // Auto-fill safety interval for pesticide applications
  if (type === '打药' && details?.pesticide_name) {
    const pesticides = loadKnowledge('pesticides/safety_data.yml');
    const pesticide = pesticides?.pesticides?.find(p => p.name === details.pesticide_name);
    if (pesticide) {
      operation.safety_interval = pesticide.safety_interval_days;
      operation.safety_interval_end = calculateFutureDate(date, pesticide.safety_interval_days);

      // Pesticide safety check
      const warnings = checkPesticideSafety(pesticide, details);
      if (warnings.length > 0) {
        operation.warnings = warnings;
      }
    }
  }

  // Auto-deduct inventory
  if (type === '打药' && details?.pesticide_name && details?.dosage) {
    deductInventory('pesticide', details.pesticide_name, details.dosage);
  }
  if (type === '施肥' && details?.fertilizer_name && details?.dosage) {
    deductInventory('fertilizer', details.fertilizer_name, details.dosage);
  }

  const ops = getOperations();
  ops.push(operation);
  saveOperations(ops);

  res.status(201).json(operation);
});

// DELETE /api/operations/:id
router.delete('/:id', (req, res) => {
  const ops = getOperations();
  const idx = ops.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '记录不存在' });
  ops.splice(idx, 1);
  saveOperations(ops);
  res.json({ success: true });
});

// GET /api/operations/stats
router.get('/stats', (req, res) => {
  const ops = getOperations();
  const period = req.query.period || 'month';
  const now = new Date();
  let startDate;

  if (period === 'week') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startStr = startDate.toISOString().slice(0, 10);
  const filtered = ops.filter(o => o.date >= startStr);

  const stats = {};
  for (const type of VALID_TYPES) {
    stats[type] = filtered.filter(o => o.type === type).length;
  }
  stats.total = filtered.length;

  res.json(stats);
});

function calculateFutureDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function checkPesticideSafety(pesticide, details) {
  const warnings = [];
  // Weather-based warnings would be checked via weather service
  // Stage-based warnings
  if (pesticide.contraindications?.stage?.includes('花期')) {
    warnings.push(`${pesticide.name}在花期慎用`);
  }
  return warnings;
}

function deductInventory(type, name, amount) {
  try {
    const config = getConfig();
    if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };

    const list = type === 'pesticide' ? config.inventory.pesticides : config.inventory.fertilizers;
    const idx = list.findIndex(item => item.name === name);
    if (idx !== -1 && list[idx].quantity != null) {
      list[idx].quantity = Math.max(0, list[idx].quantity - (parseFloat(amount) || 0));
      saveConfig(config);
    }
  } catch (err) {
    console.error('[Inventory] Deduction failed:', err.message);
  }
}

import { loadKnowledge } from '../services/knowledgeLoader.js';

// GET /api/operations/export
router.get('/export', (req, res) => {
  let ops = getOperations();
  ops.sort((a, b) => b.date.localeCompare(a.date));

  const BOM = '\uFEFF';
  const columns = ['日期', '类型', '作物', '棚区', '肥料/农药', '用量', '单位', '备注', '创建时间'];
  const rows = ops.map(o => ({
    '日期': o.date || '',
    '类型': o.type || '',
    '作物': o.crop_name || '',
    '棚区': o.greenhouse_name || '',
    '肥料/农药': o.details?.fertilizer_name || o.details?.pesticide_name || '',
    '用量': o.details?.dosage || '',
    '单位': o.details?.unit || '',
    '备注': o.note || '',
    '创建时间': o.created_at || ''
  }));

  const csvContent = stringify(rows, { header: true, columns });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('全部操作记录.csv')}`);
  res.send(BOM + csvContent);
});

export default router;
