import { Router } from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { readYaml, writeYaml } from '../services/yamlUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.yml');

function getConfig() { return readYaml(CONFIG_PATH) || {}; }
function saveConfig(config) { return writeYaml(CONFIG_PATH, config); }

const router = Router();

// GET /api/greenhouses
router.get('/', (req, res) => {
  const config = getConfig();
  res.json(config.greenhouses || []);
});

// GET /api/greenhouses/:id
router.get('/:id', (req, res) => {
  const config = getConfig();
  const gh = (config.greenhouses || []).find(g => g.id === req.params.id);
  if (!gh) return res.status(404).json({ error: '棚区不存在' });
  res.json(gh);
});

// POST /api/greenhouses
router.post('/', (req, res) => {
  const { name, area, type, orientation, cover_material, insulation, ventilation, irrigation, heating, shading, insect_net } = req.body;

  // Validate name
  if (!name || name.length > 8) return res.status(400).json({ error: '棚区名称必填，最多8个字' });

  // Validate area
  if (area != null && (area < 100 || area > 5000)) return res.status(400).json({ error: '面积需在100-5000m²之间' });

  const config = getConfig();
  if (!config.greenhouses) config.greenhouses = [];

  const greenhouse = {
    id: uuidv4(),
    name,
    area: area || null,
    type: type || null, // 日光温室/大拱棚/连栋温室/简易棚
    orientation: orientation || null,
    cover_material: cover_material || null,
    insulation: insulation || null,
    ventilation: ventilation || null,
    irrigation: irrigation || null,
    heating: heating || '无',
    shading: shading || '无',
    insect_net: insect_net || '无',
    created_at: new Date().toISOString()
  };

  config.greenhouses.push(greenhouse);
  saveConfig(config);
  res.status(201).json(greenhouse);
});

// PUT /api/greenhouses/:id
router.put('/:id', (req, res) => {
  const config = getConfig();
  const idx = (config.greenhouses || []).findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '棚区不存在' });

  const allowed = ['name', 'area', 'type', 'orientation', 'cover_material', 'insulation', 'ventilation', 'irrigation', 'heating', 'shading', 'insect_net'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) config.greenhouses[idx][key] = req.body[key];
  }
  config.greenhouses[idx].updated_at = new Date().toISOString();
  saveConfig(config);
  res.json(config.greenhouses[idx]);
});

// DELETE /api/greenhouses/:id
router.delete('/:id', (req, res) => {
  const config = getConfig();
  const crops = config.crops || [];
  const hasActiveCrops = crops.some(c => c.greenhouse_id === req.params.id && c.status !== 'archived');
  if (hasActiveCrops) return res.status(400).json({ error: '该棚区下有活跃作物，无法删除' });

  config.greenhouses = (config.greenhouses || []).filter(g => g.id !== req.params.id);
  saveConfig(config);
  res.json({ success: true });
});

export default router;
