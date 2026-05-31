/**
 * wttr.in Weather Plugin
 * Backup weather source - free, no API key
 * Provides: current weather + 3-day forecast
 */
export default {
  name: 'wttr.in',
  enabled: true,
  priority: 2, // Backup source

  /**
   * Fetch current weather from wttr.in
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {string} city - City name (fallback when lat/lon unavailable)
   * @returns {object|null} Weather data or null on failure
   */
  async fetchCurrent(lat, lon, city) {
    try {
      // Priority: 1) lat,lon  2) city name  3) empty (wttr.in auto-detects from request IP)
      let query;
      if (lat != null && lon != null) {
        query = `${lat},${lon}`;
      } else if (city) {
        query = encodeURIComponent(city);
      } else {
        query = ''; // wttr.in will use the requesting IP to determine location
      }
      const url = `https://wttr.in/${query}?format=j1`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'AgriExpert/1.0' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const cur = data.current_condition?.[0];
      // Try to extract resolved city name from response
      const resolvedCity = city || data.nearest_area?.[0]?.areaName?.[0]?.value || '';
      return {
        source: 'wttr.in',
        city: resolvedCity, lat, lon,
        current: cur ? {
          temperature: parseFloat(cur.temp_C),
          humidity: parseFloat(cur.humidity),
          wind_speed: parseFloat(cur.windspeedKmph) / 3.6,
          weather_desc: cur.weatherDesc?.[0]?.value,
          precipitation: parseFloat(cur.precipMM)
        } : null,
        forecast: (data.weather || []).slice(0, 3).map(day => ({
          date: day.date,
          temp_max: parseFloat(day.maxtempC),
          temp_min: parseFloat(day.mintempC),
          precipitation: parseFloat(day.hourly?.[4]?.precipMM || 0),
          weather_desc: day.hourly?.[4]?.weatherDesc?.[0]?.value
        }))
      };
    } catch (err) {
      console.error('[wttr.in] Failed:', err.message);
      return null;
    }
  }
};
