import { Router } from 'express';
import { runRuleEngine } from '../services/ruleEngine.js';
import { getCurrentWeather } from '../services/weatherService.js';
import { readYaml } from '../services/yamlUtils.js';
import path from 'path';
import { DATA_DIR } from '../services/paths.js';

const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');
const OPERATIONS_PATH = path.join(DATA_DIR, 'operations.yml');
const DECISIONS_CACHE_PATH = path.join(DATA_DIR, 'decisions_cache.yml');

const router = Router();

// GET /api/decisions - get rule engine decisions
router.get('/', async (req, res) => {
  try {
    const config = readYaml(CONFIG_PATH) || {};
    const activeCrops = (config.crops || []).filter(c => c.status === 'active');
    
    if (activeCrops.length === 0) {
      return res.json([]);
    }

    // Try to use cached decisions (valid for 1 hour)
    const cache = readYaml(DECISIONS_CACHE_PATH);
    if (cache?.decisions && cache.timestamp) {
      const cacheAge = Date.now() - new Date(cache.timestamp).getTime();
      if (cacheAge < 60 * 60 * 1000) {  // 1 hour
        return res.json({
          decisions: cache.decisions,
          timestamp: cache.timestamp,
          source: 'cache'
        });
      }
    }

    // No valid cache, calculate in real-time
    const weather = await getCurrentWeather();
    const operations = readYaml(OPERATIONS_PATH) || [];
    
    const decisions = runRuleEngine({
      weather,
      crops: activeCrops,
      operations,
      config
    });
    
    res.json({
      decisions,
      timestamp: new Date().toISOString(),
      source: 'realtime'
    });
  } catch (err) {
    console.error('[Decisions] Error:', err.message);
    res.json([]);
  }
});

export default router;
