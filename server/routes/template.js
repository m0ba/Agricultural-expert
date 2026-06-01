import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import { DATA_DIR } from '../services/paths.js';

const TEMPLATES_PATH = path.join(DATA_DIR, 'templates.yml');

function getTemplates() { return readYaml(TEMPLATES_PATH) || []; }
function saveTemplates(t) { return writeYaml(TEMPLATES_PATH, t); }

const router = Router();

router.get('/', (req, res) => {
  let templates = getTemplates();
  if (req.query.type) templates = templates.filter(t => t.type === req.query.type);
  res.json(templates);
});

router.post('/', (req, res) => {
  const { name, type, values } = req.body;
  if (!name) return res.status(400).json({ error: '模板名称必填' });
  if (!type) return res.status(400).json({ error: '操作类型必填' });

  const templates = getTemplates();
  const template = {
    id: uuidv4(),
    name,
    type,
    values: values || {},
    created_at: new Date().toISOString()
  };
  templates.push(template);
  saveTemplates(templates);
  res.status(201).json(template);
});

router.delete('/:id', (req, res) => {
  let templates = getTemplates();
  const before = templates.length;
  templates = templates.filter(t => t.id !== req.params.id);
  if (templates.length === before) return res.status(404).json({ error: '模板不存在' });
  saveTemplates(templates);
  res.json({ success: true });
});

export default router;
