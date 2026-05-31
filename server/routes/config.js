import { Router } from 'express';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.yml');

const router = Router();

// GET /api/config
router.get('/', (req, res) => {
  const config = readYaml(CONFIG_PATH) || {};
  // Mask API key in response
  if (config.ai?.api_key) {
    config.ai.api_key_masked = config.ai.api_key.slice(0, 4) + '****' + config.ai.api_key.slice(-4);
  }
  res.json(config);
});

// PUT /api/config
router.put('/', (req, res) => {
  const current = readYaml(CONFIG_PATH) || {};
  const updated = { ...current, ...req.body };
  if (req.body.ai) {
    updated.ai = { ...current.ai, ...req.body.ai };
  }
  writeYaml(CONFIG_PATH, updated);
  res.json({ success: true });
});

// GET /api/config/plugins - Get plugin status
router.get('/plugins', async (req, res) => {
  try {
    const pluginRegistry = (await import('../plugins/index.js')).default;
    res.json(pluginRegistry.getStatus());
  } catch (err) {
    res.status(500).json({ error: '获取插件状态失败' });
  }
});

// GET /api/config/locate - IP-based location proxy with multiple fallbacks
router.get('/locate', async (req, res) => {
  let result = null;

  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || req.ip || '';

  const ipForService = clientIP && clientIP !== '::1' && clientIP !== '127.0.0.1' ? clientIP : '';

  try {
    const wttrUrl = ipForService ? `https://wttr.in/${ipForService}?format=j1` : 'https://wttr.in/?format=j1';
    const wttrRes = await fetch(wttrUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'AgriExpert/1.0' }
    });
    const wttrData = await wttrRes.json();
    const area = wttrData.nearest_area?.[0];
    if (area) {
      const lat = parseFloat(area.latitude);
      const lon = parseFloat(area.longitude);
      if (lat && lon) {
        result = {
          city: area.areaName?.[0]?.value || '',
          region: area.region?.[0]?.value || '',
          country: area.country?.[0]?.value || '',
          lat, lon,
          ip: clientIP,
          source: 'wttr.in'
        };
      }
    }
  } catch (e) {
    console.error('[Locate] wttr.in failed:', e.message);
  }

  if (!result) {
    try {
      const ipApiUrl = ipForService ? `http://ip-api.com/json/${ipForService}?fields=status,country,regionName,city,lat,lon,query` : 'http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon,query';
      const response = await fetch(ipApiUrl, {
        signal: AbortSignal.timeout(6000)
      });
      const data = await response.json();
      if (data.status === 'success' && data.lat) {
        result = {
          city: data.city || '',
          region: data.regionName || '',
          country: data.country || '',
          lat: data.lat,
          lon: data.lon,
          ip: data.query || clientIP || '',
          source: `IP (${data.query || clientIP || 'unknown'})`
        };
      }
    } catch (e) {
      console.error('[Locate] ip-api.com failed:', e.message);
    }
  }

  if (!result) {
    try {
      const ipwhoUrl = ipForService ? `https://ipwho.is/${ipForService}?fields=ip,city,region,country,latitude,longitude` : 'https://ipwho.is/?fields=ip,city,region,country,latitude,longitude';
      const response = await fetch(ipwhoUrl, {
        signal: AbortSignal.timeout(6000)
      });
      const data = await response.json();
      if (data.success !== false && data.latitude) {
        result = {
          city: data.city || '',
          region: data.region || '',
          country: data.country || '',
          lat: data.latitude,
          lon: data.longitude,
          ip: data.ip || clientIP || '',
          source: `IP (${data.ip || clientIP || 'unknown'})`
        };
      }
    } catch (e) {
      console.error('[Locate] ipwho.is failed:', e.message);
    }
  }

  if (!result) {
    try {
      const geojsUrl = ipForService ? `https://get.geojs.io/v1/ip/geo/${ipForService}` : 'https://get.geojs.io/v1/ip/geo.json';
      const response = await fetch(geojsUrl, {
        signal: AbortSignal.timeout(6000)
      });
      const data = await response.json();
      if (data.latitude) {
        result = {
          city: data.city || '',
          region: data.region || '',
          country: data.country || '',
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude),
          ip: data.ip || clientIP || '',
          source: `IP (${data.ip || clientIP || 'unknown'})`
        };
      }
    } catch (e) {
      console.error('[Locate] geojs failed:', e.message);
    }
  }

  if (result) {
    // Auto-save to config
    try {
      const config = readYaml(CONFIG_PATH) || {};
      config.city = result.city;
      config.city_source = result.source;
      config.lat = result.lat;
      config.lon = result.lon;
      writeYaml(CONFIG_PATH, config);
    } catch (saveErr) {
      console.error('[Locate] Auto-save failed:', saveErr.message);
    }
    res.json({ success: true, ...result });
  } else {
    res.json({ success: false, error: 'IP定位服务均不可用，请手动输入城市' });
  }
});

// GET /api/config/reverse-geocode - Reverse geocode GPS coordinates to city name
router.get('/reverse-geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.json({ success: false, error: '缺少坐标参数' });

  // 1) BigDataCloud（返回中文地名，优先使用）
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await response.json();
    if (data.city || data.locality) {
      const city = data.locality || data.city || '';
      const region = data.principalSubdivision || '';
      const country = data.countryName || '';
      return res.json({ success: true, city, region, country });
    }
  } catch (e) {
    console.error('[ReverseGeocode] BigDataCloud failed:', e.message);
  }

  // 2) wttr.in 坐标反向编码（返回英文名，作为备选）
  try {
    const wttrRes = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
      signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AgriExpert/1.0' } });
    const wttrData = await wttrRes.json();
    const area = wttrData.nearest_area?.[0];
    if (area) {
      const name = area.areaName?.[0]?.value || '';
      const region = area.region?.[0]?.value || '';
      if (name) return res.json({ success: true, city: name, region, source: 'wttr.in' });
    }
  } catch (e) {
    console.error('[ReverseGeocode] wttr.in failed:', e.message);
  }

  // 3) Nominatim (OpenStreetMap)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=zh-CN`,
      { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'AgriExpert/1.0' } }
    );
    const data = await response.json();
    if (data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.county || '';
      const region = data.address.state || '';
      const country = data.address.country || '';
      return res.json({ success: true, city, region, country });
    }
  } catch (e) {
    console.error('[ReverseGeocode] Nominatim failed:', e.message);
  }

  res.json({ success: false, error: '反向地理编码失败' });
});

export default router;
