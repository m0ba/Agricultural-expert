import { Router } from 'express';
const router = Router();

// GET /api/weather - get current weather data
router.get('/', async (req, res) => {
  try {
    const { getCurrentWeather } = await import('../services/weatherService.js');
    const data = await getCurrentWeather();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '获取天气数据失败' });
  }
});

// GET /api/weather/history - get historical weather data
router.get('/history', async (req, res) => {
  try {
    const { getWeatherHistory } = await import('../services/weatherService.js');
    const days = parseInt(req.query.days) || 7;
    const data = await getWeatherHistory(days);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '获取历史天气失败' });
  }
});

// POST /api/weather/update - force weather update
router.post('/update', async (req, res) => {
  try {
    const { updateWeather } = await import('../services/weatherService.js');
    const data = await updateWeather();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: '天气更新失败' });
  }
});

// POST /api/weather/save-history - manually save weather history (for testing)
router.post('/save-history', async (req, res) => {
  try {
    const { getCurrentWeather, saveWeatherHistory, cleanupWeatherHistory } = await import('../services/weatherService.js');
    await getCurrentWeather();
    await saveWeatherHistory();
    await cleanupWeatherHistory();
    res.json({ success: true, message: '天气历史已保存' });
  } catch (err) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

export default router;
