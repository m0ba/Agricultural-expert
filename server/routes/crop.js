import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import { loadKnowledge } from '../services/knowledgeLoader.js';
import { DATA_DIR } from '../services/paths.js';

const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

function getConfig() { return readYaml(CONFIG_PATH) || {}; }
function saveConfig(config) { return writeYaml(CONFIG_PATH, config); }

const router = Router();

// Growth stage order
const STAGE_ORDER = ['育苗期', '定植缓苗期', '初花期', '盛果期', '采收期'];

// GET /api/crops
router.get('/', (req, res) => {
  const config = getConfig();
  let crops = config.crops || [];
  if (req.query.status) crops = crops.filter(c => c.status === req.query.status);
  if (req.query.greenhouse_id) crops = crops.filter(c => c.greenhouse_id === req.query.greenhouse_id);
  res.json(crops);
});

// Helper to load knowledge dir
import { loadKnowledgeDir } from '../services/knowledgeLoader.js';

// GET /api/crops/available-types
router.get('/available-types', (req, res) => {
  const crops = loadKnowledgeDir('crops');
  const types = Object.keys(crops).map(name => ({
    name,
    family: crops[name].family,
    total_days: crops[name].total_days,
    stages: crops[name].stages?.map(s => s.name) || []
  }));
  res.json(types);
});

// GET /api/crops/:id
router.get('/:id', (req, res) => {
  const config = getConfig();
  const crop = (config.crops || []).find(c => c.id === req.params.id);
  if (!crop) return res.status(404).json({ error: '作物不存在' });
  res.json(crop);
});

// POST /api/crops
router.post('/', (req, res) => {
  const {
    greenhouse_id, crop_type, variety_name, planting_date, current_stage,
    quantity, seed_source, nursery_method, seedling_age, grafted, prev_crop,
    target_yield, stage_detail
  } = req.body;

  // Validation
  if (!greenhouse_id) return res.status(400).json({ error: '请选择所属棚区' });
  if (!crop_type) return res.status(400).json({ error: '请选择作物类型' });
  if (!planting_date) return res.status(400).json({ error: '请选择定植日期' });
  if (!current_stage) return res.status(400).json({ error: '请选择当前生长阶段' });
  if (!STAGE_ORDER.includes(current_stage)) return res.status(400).json({ error: '无效的生长阶段' });
  if (quantity != null && (quantity < 100 || quantity > 50000)) return res.status(400).json({ error: '种植数量需在100-50000之间' });

  const config = getConfig();
  if (!config.crops) config.crops = [];
  const gh = (config.greenhouses || []).find(g => g.id === greenhouse_id);

  const crop = {
    id: uuidv4(),
    greenhouse_id,
    greenhouse_name: gh?.name || '未知棚区',
    type: crop_type,
    variety_name: variety_name || '未指定',
    planting_date,
    current_stage,
    quantity: quantity || null,
    seed_source: seed_source || null,
    nursery_method: nursery_method || null,
    seedling_age: seedling_age || null,
    grafted: grafted || '否',
    prev_crop: prev_crop || null,
    target_yield: target_yield || null,
    stage_detail: stage_detail || {},
    planting_plan: null, // Will be populated by AI later
    status: 'active',
    created_at: new Date().toISOString()
  };

  // Calculate days after transplant
  const plantDate = new Date(planting_date);
  const now = new Date();
  crop.days_after_transplant = Math.floor((now - plantDate) / (1000 * 60 * 60 * 24));

  config.crops.push(crop);
  saveConfig(config);
  res.status(201).json(crop);
});

// PUT /api/crops/:id
router.put('/:id', (req, res) => {
  const config = getConfig();
  const idx = (config.crops || []).findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '作物不存在' });

  const allowed = ['greenhouse_id', 'type', 'variety_name', 'planting_date', 'current_stage', 'quantity', 'seed_source', 'nursery_method', 'seedling_age', 'grafted', 'prev_crop', 'target_yield', 'stage_detail', 'planting_plan', 'status'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) config.crops[idx][key] = req.body[key];
  }

  // Update greenhouse name if changed
  if (req.body.greenhouse_id) {
    const gh = (config.greenhouses || []).find(g => g.id === req.body.greenhouse_id);
    config.crops[idx].greenhouse_name = gh?.name || '未知棚区';
  }

  config.crops[idx].updated_at = new Date().toISOString();
  saveConfig(config);
  res.json(config.crops[idx]);
});

// POST /api/crops/:id/advance-stage
router.post('/:id/advance-stage', (req, res) => {
  const config = getConfig();
  const idx = (config.crops || []).findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '作物不存在' });

  const crop = config.crops[idx];
  const currentIdx = STAGE_ORDER.indexOf(crop.current_stage);
  if (currentIdx === -1 || currentIdx >= STAGE_ORDER.length - 1) {
    return res.status(400).json({ error: '无法继续推进阶段' });
  }

  const nextStage = STAGE_ORDER[currentIdx + 1];
  config.crops[idx].current_stage = nextStage;
  config.crops[idx].stage_detail = {}; // Reset stage detail for new stage
  config.crops[idx].updated_at = new Date().toISOString();
  saveConfig(config);
  res.json(config.crops[idx]);
});

// DELETE /api/crops/:id (archive)
router.delete('/:id', (req, res) => {
  const config = getConfig();
  const idx = (config.crops || []).findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '作物不存在' });
  config.crops[idx].status = 'archived';
  config.crops[idx].updated_at = new Date().toISOString();
  saveConfig(config);
  res.json({ success: true });
});

export default router;
