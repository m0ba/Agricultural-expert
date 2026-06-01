import { Router } from 'express';
import path from 'path';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import { DATA_DIR } from '../services/paths.js';

const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

function getConfig() { return readYaml(CONFIG_PATH) || {}; }
function saveConfig(config) { return writeYaml(CONFIG_PATH, config); }

const router = Router();

router.get('/', (req, res) => {
  const config = getConfig();
  res.json(config.inventory || { pesticides: [], fertilizers: [] });
});

router.put('/', (req, res) => {
  const config = getConfig();
  if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };
  if (req.body.pesticides) config.inventory.pesticides = req.body.pesticides;
  if (req.body.fertilizers) config.inventory.fertilizers = req.body.fertilizers;
  saveConfig(config);
  res.json(config.inventory);
});

router.post('/pesticide', (req, res) => {
  const { name, quantity, unit } = req.body;
  if (!name) return res.status(400).json({ error: '药品名称必填' });
  const config = getConfig();
  if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };
  const idx = config.inventory.pesticides.findIndex(p => p.name === name);
  if (idx !== -1) {
    config.inventory.pesticides[idx].quantity = quantity;
    config.inventory.pesticides[idx].unit = unit;
  } else {
    config.inventory.pesticides.push({ name, quantity: quantity || 0, unit: unit || '瓶' });
  }
  saveConfig(config);
  res.json(config.inventory);
});

router.post('/fertilizer', (req, res) => {
  const { name, quantity, unit } = req.body;
  if (!name) return res.status(400).json({ error: '肥料名称必填' });
  const config = getConfig();
  if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };
  const idx = config.inventory.fertilizers.findIndex(f => f.name === name);
  if (idx !== -1) {
    config.inventory.fertilizers[idx].quantity = quantity;
    config.inventory.fertilizers[idx].unit = unit;
  } else {
    config.inventory.fertilizers.push({ name, quantity: quantity || 0, unit: unit || '袋' });
  }
  saveConfig(config);
  res.json(config.inventory);
});


// PUT /api/inventory/:type/:index - update specific item
router.put('/:type/:index', (req, res) => {
  const { type, index } = req.params;
  const { quantity } = req.body;
  const config = getConfig();
  if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };
  const list = type === 'pesticide' ? config.inventory.pesticides : config.inventory.fertilizers;
  const idx = parseInt(index);
  if (idx < 0 || idx >= list.length) return res.status(404).json({ error: '项目不存在' });
  if (quantity != null) list[idx].quantity = quantity;
  saveConfig(config);
  res.json(config.inventory);
});

// POST /api/inventory - add item (generic)
router.post('/', (req, res) => {
  const { type, name, quantity, unit } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const config = getConfig();
  if (!config.inventory) config.inventory = { pesticides: [], fertilizers: [] };
  const list = type === 'pesticide' ? config.inventory.pesticides : config.inventory.fertilizers;
  const defaultUnit = type === 'pesticide' ? '瓶' : '袋';
  const existing = list.findIndex(i => i.name === name);
  if (existing !== -1) {
    list[existing].quantity = (list[existing].quantity || 0) + (parseFloat(quantity) || 0);
  } else {
    list.push({ name, quantity: parseFloat(quantity) || 0, unit: unit || defaultUnit });
  }
  saveConfig(config);
  res.json(config.inventory);
});

export default router;
