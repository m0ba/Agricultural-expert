/**
 * Weather Service - IP定位 + 用户城市
 * Sources: Open-Meteo (主用) + wttr.in (备用)
 */
import { readYaml, writeYaml } from './yamlUtils.js';
import path from 'path';
import fs from 'fs';
import pluginRegistry from '../plugins/index.js';
import { DATA_DIR } from './paths.js';

const HISTORY_DIR = path.join(DATA_DIR, 'weather_history');
const CONFIG_PATH = path.join(DATA_DIR, 'config.yml');

let cachedWeather = null;
let cacheTime = null;
let lastCity = null;

if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

// City -> lat/lon mapping
const cityCoords = {
  '北京': [39.9, 116.4], '上海': [31.2, 121.5], '广州': [23.1, 113.3],
  '深圳': [22.5, 114.1], '天津': [39.1, 117.2], '重庆': [29.6, 106.5],
  '石家庄': [38.0, 114.5], '太原': [37.9, 112.6], '呼和浩特': [40.8, 111.7],
  '沈阳': [41.8, 123.4], '长春': [43.9, 125.3], '哈尔滨': [45.8, 126.5],
  '南京': [32.1, 118.8], '杭州': [30.3, 120.2], '合肥': [31.8, 117.2],
  '福州': [26.1, 119.3], '南昌': [28.7, 115.9], '济南': [36.7, 116.9],
  '郑州': [34.7, 113.7], '武汉': [30.6, 114.3], '长沙': [28.2, 113.0],
  '南宁': [22.8, 108.3], '海口': [20.0, 110.3], '成都': [30.6, 104.1],
  '贵阳': [26.6, 106.7], '昆明': [25.0, 102.7], '拉萨': [29.6, 91.1],
  '西安': [34.3, 108.9], '兰州': [36.1, 103.8], '西宁': [36.6, 101.8],
  '银川': [38.5, 106.3], '乌鲁木齐': [43.8, 87.6], '大连': [38.9, 121.6],
  '青岛': [36.1, 120.4], '宁波': [29.9, 121.5], '厦门': [24.5, 118.1],
  '寿光': [36.9, 118.7], '青州': [36.7, 118.5], '昌乐': [36.7, 118.8],
  '莘县': [36.2, 115.7], '渭南': [34.5, 109.5], '咸阳': [34.3, 108.7]
};

/**
 * Auto-detect location from IP.
 * Uses wttr.in first (better accuracy for mobile/Chinese IPs),
 * falls back to ip-api.com.
 */
async function getCityFromIP() {
  // Try wttr.in (no location param = auto-detect from request IP)
  try {
    const res = await fetch('https://wttr.in/?format=j1', {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'AgriExpert/1.0' }
    });
    const data = await res.json();
    const area = data.nearest_area?.[0];
    if (area) {
      const city = area.areaName?.[0]?.value || '';
      const lat = parseFloat(area.latitude);
      const lon = parseFloat(area.longitude);
      if (lat && lon) {
        console.log('[wttr.in定位] Resolved:', city, lat, lon);
        return { city, lat, lon };
      }
    }
  } catch (err) {
    console.error('[wttr.in定位] Failed:', err.message);
  }

  // Fallback: ip-api.com
  try {
    const res = await fetch('http://ip-api.com/json/?fields=status,country,regionName,city,lat,lon', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.status === 'success' && data.city) {
      return { city: data.city, lat: data.lat, lon: data.lon };
    }
  } catch (err) {
    console.error('[IP定位] Failed:', err.message);
  }
  return null;
}

function getCityCoords(city) {
  if (cityCoords[city]) return { lat: cityCoords[city][0], lon: cityCoords[city][1] };
  return null;
}

/**
 * Get current weather - uses IP location or config city
 */
export async function getCurrentWeather() {
  // Check if city changed - invalidate cache
  const config = readYaml(CONFIG_PATH) || {};
  const configCity = config.city;
  if (configCity && configCity !== lastCity) {
    cachedWeather = null;
    cacheTime = null;
    lastCity = configCity;
  }

  if (cachedWeather && cacheTime && (Date.now() - cacheTime < 60 * 60 * 1000)) {
    return cachedWeather;
  }

  let city, lat, lon;

  // Priority: 1. Config city (from init), 2. IP location, 3. Default
  if (configCity) {
    city = configCity;
    // Use stored coordinates from config first (set by auto-location)
    if (config.lat && config.lon) {
      lat = config.lat;
      lon = config.lon;
    } else {
      // Fall back to static coordinate map, then IP lookup
      const coords = getCityCoords(configCity);
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
      } else {
        const ipLoc = await getCityFromIP();
        if (ipLoc) {
          lat = ipLoc.lat;
          lon = ipLoc.lon;
          // Save resolved coordinates for future use
          config.lat = lat;
          config.lon = lon;
          writeYaml(CONFIG_PATH, config);
        }
      }
    }
  } else {
    // No city configured - check if coordinates are already set (manual input / GPS)
    if (config.lat && config.lon) {
      lat = config.lat;
      lon = config.lon;
      city = null; // city name not set, but weather works with coordinates
    } else {
      // Try IP location
      const ipLoc = await getCityFromIP();
      if (ipLoc) {
        city = ipLoc.city;
        lat = ipLoc.lat;
        lon = ipLoc.lon;
        // Save to config
        if (city) config.city = city;
        config.city_source = config.city_source || 'IP';
        config.lat = lat;
        config.lon = lon;
        writeYaml(CONFIG_PATH, config);
      } else {
        city = null;
        lat = null;
        lon = null;
      }
    }
  }

  // Use plugin registry for weather sources
  const weatherPlugins = pluginRegistry.getAll('weather');
  const pluginEntries = Object.entries(weatherPlugins).sort((a, b) => (a[1].priority || 99) - (b[1].priority || 99));
  const settled = await Promise.allSettled(
    pluginEntries.map(([name, plugin]) => plugin.fetchCurrent(lat, lon, city))
  );
  const results = {};
  for (let i = 0; i < pluginEntries.length; i++) {
    results[pluginEntries[i][0]] = settled[i].status === 'fulfilled' ? settled[i].value : null;
  }

  // Build sources from plugin results
  const sources = { status: {} };
  for (const [name, result] of Object.entries(results)) {
    sources[name] = result;
    sources.status[name] = result !== null;
  }

  const merged = mergeWeatherData(sources, city);
  const sprayWindow = calculateSprayWindow(merged);

  cachedWeather = { sources, merged, sprayWindow, lastUpdate: new Date().toISOString() };
  cacheTime = Date.now();
  lastCity = city;

  return cachedWeather;
}




function mergeWeatherData(sources, city) {
  // Find first available source (ordered by priority)
  const allSources = Object.values(sources).filter(s => s && s.current);
  const primary = allSources[0];
  if (!primary) return null;

  // Prefer Open-Meteo for forecast (has 16 days), wttr for description
  const openMeteo = sources.openMeteo;
  const wttr = sources.wttr;

  const cur = {
    temperature: primary.current?.temperature,
    humidity: primary.current?.humidity,
    wind_speed: primary.current?.wind_speed,
    weather_code: primary.current?.weather_code,
    weather_desc: wttr?.current?.weather_desc || primary.current?.weather_desc || '未知',
    precipitation: primary.current?.precipitation ?? 0
  };

  const forecast = openMeteo?.forecast?.length > 0 ? openMeteo.forecast : (primary.forecast || []);
  const todayF = forecast[0] || {};
  const temperature_max = todayF.temp_max ?? cur.temperature;
  const temperature_min = todayF.temp_min ?? cur.temperature;

  return {
    temperature: cur.temperature, temperature_max, temperature_min,
    humidity: cur.humidity, wind_speed: cur.wind_speed,
    wind_speed_max: Math.max(cur.wind_speed ?? 0, forecast[0]?.wind_max ?? 0, forecast[1]?.wind_max ?? 0),
    weather_desc: cur.weather_desc, precipitation: cur.precipitation,
    precipitation_next_24h: todayF.precipitation ?? 0,
    precipitation_next_48h: (todayF.precipitation ?? 0) + (forecast[1]?.precipitation ?? 0),
    rain_days: forecast.slice(0, 7).filter(d => (d.precipitation ?? 0) > 1).length,
    sunshine_hours: todayF.sunshine_hours ?? null,
    forecast, city: city || sources.wttr?.city || sources.openMeteo?.city || '未知',
    lastUpdate: new Date().toISOString()
  };
}

function calculateSprayWindow(merged) {
  if (!merged?.forecast || merged.forecast.length < 2) return { available: false, reason: '天气数据不足' };
  const reasons = [];
  if ((merged.precipitation_next_48h ?? 0) > 5) reasons.push('未来48小时有降水');
  if ((merged.temperature ?? 0) > 35) reasons.push('当前温度超过35°C');
  if ((merged.wind_speed_max ?? 0) > 4) reasons.push('风速过大（>4级）');
  if (reasons.length > 0) return { available: false, reason: reasons.join('；') };
  const windows = [];
  const today = merged.forecast[0];
  if ((today.precipitation ?? 0) < 1 && (merged.temperature ?? 25) < 35) windows.push({ time: '今日傍晚（16:00-18:00）', reason: '傍晚温度降低，药液蒸发慢' });
  if ((today.precipitation ?? 0) < 1 && (merged.temperature ?? 25) < 30) windows.push({ time: '今日上午（08:00-10:00）', reason: '露水干后，温度适中' });
  if ((merged.forecast[1]?.precipitation ?? 0) < 1) windows.push({ time: '明日清晨（06:00-08:00）', reason: '清晨无露水时施药' });
  return windows.length > 0 ? { available: true, windows } : { available: false, reason: '暂无合适打药窗口' };
}


export async function getWeatherHistory(days = 7) {
  const result = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i - 1);
    const ds = d.toISOString().slice(0, 10);
    const data = readYaml(path.join(HISTORY_DIR, `${ds}.yml`));
    if (data?.records?.length > 0) {
      const temps = data.records.map(r => r.temperature).filter(t => t != null);
      const humidities = data.records.map(r => r.humidity).filter(h => h != null);
      result.push({
        date: ds,
        temperature_max: Math.max(...data.records.map(r => r.temperature_max || r.temperature || 0)),
        temperature_min: Math.min(...data.records.map(r => r.temperature_min || r.temperature || 100)),
        temperature_avg: temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null,
        humidity_avg: humidities.length ? (humidities.reduce((a, b) => a + b, 0) / humidities.length).toFixed(0) : null,
        precipitation: (data.records.map(r => r.precipitation || 0).reduce((a, b) => a + b, 0)).toFixed(1),
        wind_speed_avg: null,
        sunshine_hours: null,
        source: 'auto',
        status: '正常'
      });
    } else if (data && data.status !== '无数据') {
      result.push({
        ...data,
        source: data.source || 'legacy',
        status: '正常'
      });
    } else {
      result.push({ date: ds, temperature_max: null, temperature_min: null, temperature_avg: null, humidity_avg: null, precipitation: null, wind_speed_avg: null, sunshine_hours: null, source: null, status: '无数据' });
    }
  }
  return result;
}

export async function updateWeather() { cachedWeather = null; cacheTime = null; return await getCurrentWeather(); }

export function saveWeatherHistory() {
  if (!cachedWeather?.merged) return;
  const today = new Date().toISOString().slice(0, 10);
  const filePath = path.join(HISTORY_DIR, `${today}.yml`);
  const existing = readYaml(filePath) || {};
  const m = cachedWeather.merged;
  const now = new Date().toTimeString().slice(0, 5);
  const record = {
    time: now,
    temperature: m.temperature,
    temperature_max: m.temperature_max,
    temperature_min: m.temperature_min,
    humidity: m.humidity,
    wind_speed: m.wind_speed,
    weather_desc: m.weather_desc,
    precipitation: m.precipitation
  };
  if (!existing.records) existing.records = [];
  existing.records.push(record);
  existing.records.sort((a, b) => a.time.localeCompare(b.time));
  writeYaml(filePath, { date: today, ...existing });
}

export function cleanupWeatherHistory() {
  if (!fs.existsSync(HISTORY_DIR)) return;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 2);
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.yml'));
  for (const file of files) {
    const match = file.match(/^(\d{4}-\d{2}-\d{2})\.yml$/);
    if (match) {
      const fileDate = new Date(match[1]);
      if (fileDate < cutoffDate) fs.unlinkSync(path.join(HISTORY_DIR, file));
    }
  }
}

export function getWeatherSummary(weather, history) {
  if (!weather?.merged) return '天气数据暂不可用';
  const m = weather.merged;
  const parts = [`当前温度${m.temperature}°C，湿度${m.humidity}%`];
  if (m.weather_desc) parts.push(`天气：${m.weather_desc}`);
  if (m.forecast?.length >= 3) {
    const f3 = m.forecast.slice(0, 3);
    parts.push(`未来3天：${f3.map(f => `${f.temp_min}-${f.temp_max}°C`).join('、')}`);
  }
  return parts.join('；');
}
