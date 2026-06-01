/**
 * Daily Calibration Service
 * Runs at 07:00 daily via node-cron
 * 1. Extract today's operations from planting plans
 * 2. Re-run rule engine for all active crops
 */
import { readYaml, writeYaml } from './yamlUtils.js';
import { runRuleEngine } from './ruleEngine.js';
import { getCurrentWeather, getWeatherHistory } from './weatherService.js';
import path from 'path';
import { DATA_DIR } from './paths.js';

const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

export async function dailyCalibration() {
  console.log('[Calibration] Starting daily calibration...');

  const config = readYaml(CONFIG_PATH) || {};
  if (!config.initialized) {
    console.log('[Calibration] System not initialized, skipping');
    return;
  }

  const activeCrops = (config.crops || []).filter(c => c.status === 'active');
  if (activeCrops.length === 0) {
    console.log('[Calibration] No active crops, skipping');
    return;
  }

  // Update days_after_transplant for all crops
  const today = new Date();
  for (const crop of activeCrops) {
    if (crop.planting_date) {
      const plantDate = new Date(crop.planting_date);
      crop.days_after_transplant = Math.floor((today - plantDate) / (1000 * 60 * 60 * 24));
    }
  }

  writeYaml(CONFIG_PATH, config);

  // Get fresh weather and run rule engine
  try {
    const weather = await getCurrentWeather();
    const history = await getWeatherHistory(7);

    const decisions = runRuleEngine({
      weather,
      crops: activeCrops,
      operations: [],
      config
    });

    console.log(`[Calibration] Generated ${decisions.length} decision cards for ${activeCrops.length} crops`);

    // Store calibration results
    writeYaml(path.join(DATA_DIR, 'calibration.yml'), {
      date: today.toISOString().slice(0, 10),
      time: today.toISOString(),
      crops_count: activeCrops.length,
      decisions_count: decisions.length,
      decisions
    });

  } catch (err) {
    console.error('[Calibration] Error:', err.message);
  }

  console.log('[Calibration] Daily calibration completed');
}
