/**
 * Open-Meteo Weather Plugin
 * Primary weather source - free, no API key required
 * Provides: current weather + 16-day forecast + historical data
 */
export default {
  name: 'Open-Meteo',
  enabled: true,
  priority: 1, // Primary source

  /**
   * Fetch current weather from Open-Meteo
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} city - City name (for display)
   * @returns {object|null} Weather data or null on failure
   */
  async fetchCurrent(lat, lon, city) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,sunshine_duration&past_days=1&forecast_days=16&timezone=auto`;
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return {
        source: 'Open-Meteo', city, lat, lon,
        current: {
          temperature: data.current?.temperature_2m,
          humidity: data.current?.relative_humidity_2m,
          wind_speed: data.current?.wind_speed_10m,
          weather_code: data.current?.weather_code,
          weather_desc: this.codeToDesc(data.current?.weather_code),
          precipitation: data.current?.precipitation
        },
        forecast: data.daily ? this.parseDaily(data.daily) : []
      };
    } catch (err) {
      console.error('[Open-Meteo] Failed:', err.message);
      return null;
    }
  },

  parseDaily(daily) {
    const result = [];
    if (!daily?.time) return result;
    for (let i = 0; i < daily.time.length; i++) {
      result.push({
        date: daily.time[i], temp_max: daily.temperature_2m_max?.[i], temp_min: daily.temperature_2m_min?.[i],
        precipitation: daily.precipitation_sum?.[i], precipitation_probability: daily.precipitation_probability_max?.[i],
        wind_max: daily.wind_speed_10m_max?.[i], weather_code: daily.weather_code?.[i],
        sunshine_hours: daily.sunshine_duration?.[i] != null ? daily.sunshine_duration[i] / 3600 : null
      });
    }
    return result;
  },

  codeToDesc(code) {
    const m = { 0:'晴',1:'大部晴',2:'多云',3:'阴天',45:'雾',48:'雾凇',51:'小毛毛雨',53:'中毛毛雨',55:'大毛毛雨',61:'小雨',63:'中雨',65:'大雨',71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'阵雨',82:'阵雨',95:'雷暴' };
    return m[code] ?? '未知';
  }
};
