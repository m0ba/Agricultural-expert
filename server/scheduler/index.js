import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let initialized = false;

export function initScheduler() {
  if (initialized) return;
  initialized = true;

  // 6 times daily: 04:00, 07:00, 10:00, 13:00, 16:00, 19:00
  const weatherSchedule = '0 4,7,10,13,16,19 * * *';
  cron.schedule(weatherSchedule, async () => {
    console.log(`[Scheduler] Weather update triggered at ${new Date().toISOString()}`);
    try {
      const { updateWeather } = await import('../services/weatherService.js');
      await updateWeather();
      console.log('[Scheduler] Weather update completed');
    } catch (err) {
      console.error('[Scheduler] Weather update failed:', err.message);
    }
  });

  // Daily calibration at 07:00
  cron.schedule('0 7 * * *', async () => {
    console.log('[Scheduler] Daily calibration triggered');
    try {
      const { dailyCalibration } = await import('../services/calibrationService.js');
      await dailyCalibration();
      console.log('[Scheduler] Daily calibration completed');
    } catch (err) {
      console.error('[Scheduler] Daily calibration failed:', err.message);
    }
  });

  // Save weather history every 2 hours: 0:00, 2:00, 4:00, 6:00, 8:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00
  cron.schedule('0 */2 * * *', async () => {
    console.log(`[Scheduler] Weather history save triggered at ${new Date().toISOString()}`);
    try {
      const { getCurrentWeather, saveWeatherHistory, cleanupWeatherHistory } = await import('../services/weatherService.js');
      await getCurrentWeather();  // 先刷新缓存
      await saveWeatherHistory();
      await cleanupWeatherHistory();
      console.log('[Scheduler] Weather history save completed');
    } catch (err) {
      console.error('[Scheduler] Weather history save failed:', err.message);
    }
  });

  // Auto update system decisions every 1 hour
  cron.schedule('0 * * * *', async () => {
    console.log(`[Scheduler] Auto decisions update triggered at ${new Date().toISOString()}`);
    try {
      const { runRuleEngine } = await import('../services/ruleEngine.js');
      const { getCurrentWeather } = await import('../services/weatherService.js');
      const { readYaml, writeYaml } = await import('../services/yamlUtils.js');
      const config = readYaml(path.join(__dirname, '..', 'data', 'config.yml')) || {};
      const operations = readYaml(path.join(__dirname, '..', 'data', 'operations.yml')) || [];
      
      const activeCrops = (config.crops || []).filter(c => c.status === 'active');
      if (activeCrops.length === 0) return;
      
      const weather = await getCurrentWeather();
      const decisions = runRuleEngine({ weather, crops: activeCrops, operations, config });
      
      const decisionsPath = path.join(__dirname, '..', 'data', 'decisions_cache.yml');
      writeYaml(decisionsPath, {
        decisions,
        timestamp: new Date().toISOString(),
        source: 'auto'
      });
      console.log('[Scheduler] Auto decisions update completed:', decisions.length, 'cards');
    } catch (err) {
      console.error('[Scheduler] Auto decisions update failed:', err.message);
    }
  });

  // Auto AI analysis every 3 hours between 04:00 and 19:00 (04, 07, 10, 13, 16, 19)
  cron.schedule('0 4,7,10,13,16,19 * * *', async () => {
    console.log(`[Scheduler] Auto AI analysis triggered at ${new Date().toISOString()}`);
    try {
      const { analyzeWithAI } = await import('../services/aiService.js');
      const { readYaml, writeYaml } = await import('../services/yamlUtils.js');
      const config = readYaml(path.join(__dirname, '..', 'data', 'config.yml')) || {};
      
      if (!config.ai?.enabled) {
        console.log('[Scheduler] AI not enabled, skipping');
        return;
      }
      
      const result = await analyzeWithAI(config.ai, {});
      const resultsPath = path.join(__dirname, '..', 'data', 'ai_results.yml');
      const results = readYaml(resultsPath) || {};
      results.last_analysis = {
        data: result,
        timestamp: new Date().toISOString(),
        source: 'auto'
      };
      writeYaml(resultsPath, results);
      console.log('[Scheduler] Auto AI analysis completed');
    } catch (err) {
      console.error('[Scheduler] Auto AI analysis failed:', err.message);
    }
  });

  // Reset AI usage at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Scheduler] AI usage reset');
    try {
      const { resetDailyUsage } = await import('../services/aiService.js');
      await resetDailyUsage();
    } catch (err) {
      console.error('[Scheduler] AI usage reset failed:', err.message);
    }
  });

  console.log('[Scheduler] All cron jobs initialized');
}
