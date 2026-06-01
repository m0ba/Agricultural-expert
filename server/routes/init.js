import { Router } from 'express';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import path from 'path';
import { DATA_DIR } from '../services/paths.js';

const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

const router = Router();

// POST /api/init - batch write initialization data
router.post('/', (req, res) => {
  try {
    const { greenhouses, crops, cultivation_mode, city, city_source, lat, lon, scale, cultivation_method, soil, substrate, water_fertilizer, equipment, history, ai } = req.body;
    
    const config = readYaml(CONFIG_PATH) || {};
    
    if (greenhouses) config.greenhouses = greenhouses;
    if (crops) {
      // Ensure all crops have status, greenhouse_name, and days_after_transplant
      config.crops = crops.map(c => {
        const gh = (greenhouses || config.greenhouses || []).find(g => g.id === c.greenhouse_id);
        const plantDate = c.planting_date ? new Date(c.planting_date) : null;
        return {
          ...c,
          status: c.status || 'active',
          greenhouse_name: gh?.name || c.greenhouse_name || '未知棚区',
          days_after_transplant: plantDate ? Math.floor((Date.now() - plantDate.getTime()) / (1000 * 60 * 60 * 24)) : null
        };
      });
    }
    if (cultivation_mode) config.cultivation_mode = cultivation_mode;
    if (city) config.city = city;
    if (city_source) config.city_source = city_source;
    if (lat) config.lat = lat;
    if (lon) config.lon = lon;
    if (scale) config.scale = scale;
    if (cultivation_method) config.cultivation_method = cultivation_method;
    if (soil) config.soil = soil;
    if (substrate) config.substrate = substrate;
    if (water_fertilizer) config.water_fertilizer = water_fertilizer;
    if (equipment) config.equipment = equipment;
    if (history) config.history = history;
    if (ai) config.ai = { ...config.ai, ...ai };
    config.initialized = true;
    
    writeYaml(CONFIG_PATH, config);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '初始化失败: ' + err.message });
  }
});


// DELETE /api/init - delete ALL data and reset to uninitialized state
router.delete('/', async (req, res) => {
  try {
    const fs = await import('fs');
    const pathMod = await import('path');
    const dataDir = DATA_DIR;

    // Reset config.yml to empty
    writeYaml(CONFIG_PATH, {});

    // Clear operations.yml
    writeYaml(pathMod.join(dataDir, 'operations.yml'), []);

    // Clear templates.yml
    writeYaml(pathMod.join(dataDir, 'templates.yml'), []);

    // Clear ai_results.yml
    writeYaml(pathMod.join(dataDir, 'ai_results.yml'), {});

    // Clear ai_usage.yml
    writeYaml(pathMod.join(dataDir, 'ai_usage.yml'), {});

    // Clear custom_metrics.yml
    writeYaml(pathMod.join(dataDir, 'custom_metrics.yml'), {});

    // Clear records directory
    const recordsDir = pathMod.join(dataDir, 'records');
    if (fs.existsSync(recordsDir)) {
      const files = fs.readdirSync(recordsDir);
      for (const f of files) {
        if (f.startsWith('.')) continue;
        fs.unlinkSync(pathMod.join(recordsDir, f));
      }
    }

    // Clear weather_history directory
    const weatherDir = pathMod.join(dataDir, 'weather_history');
    if (fs.existsSync(weatherDir)) {
      const files = fs.readdirSync(weatherDir);
      for (const f of files) {
        if (f.startsWith('.')) continue;
        fs.unlinkSync(pathMod.join(weatherDir, f));
      }
    }

    // Clear experiments directory recursively
    const experimentsDir = pathMod.join(dataDir, 'experiments');
    if (fs.existsSync(experimentsDir)) {
      fs.rmSync(experimentsDir, { recursive: true, force: true });
    }

    res.json({ success: true, message: '所有数据已清除' });
  } catch (err) {
    res.status(500).json({ error: '清除数据失败: ' + err.message });
  }
});

export default router;
