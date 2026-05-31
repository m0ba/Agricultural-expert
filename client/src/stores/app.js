import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import axios from 'axios';

if (window.Capacitor?.isNativePlatform?.()) {
  axios.defaults.baseURL = 'http://127.0.0.1:3000';
}

export const useAppStore = defineStore('app', () => {
  const config = ref({});
  const greenhouses = ref([]);
  const crops = ref([]);
  const weather = ref(null);
  const weatherHistory = ref([]);
  const operations = ref([]);
  const templates = ref([]);
  const aiUsage = ref({});
  const initialized = ref(false);
  const loading = ref(false);

  async function fetchConfig() {
    try {
      const res = await axios.get('/api/config');
      config.value = res.data;
      initialized.value = res.data.initialized || false;
      greenhouses.value = res.data.greenhouses || [];
      crops.value = res.data.crops || [];
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  async function fetchWeather() {
    try {
      const res = await axios.get('/api/weather');
      weather.value = res.data;
    } catch (err) {
      console.error('Failed to fetch weather:', err);
    }
  }

  async function updateWeather() {
    try {
      const res = await axios.post('/api/weather/update');
      weather.value = res.data;
    } catch (err) {
      console.error('Failed to update weather:', err);
    }
  }

  async function fetchWeatherHistory(days = 7) {
    try {
      const res = await axios.get(`/api/weather/history?days=${days}`);
      weatherHistory.value = res.data;
    } catch (err) {
      console.error('Failed to fetch weather history:', err);
    }
  }

  async function fetchOperations(params = {}) {
    try {
      const res = await axios.get('/api/operations', { params });
      operations.value = res.data;
    } catch (err) {
      console.error('Failed to fetch operations:', err);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await axios.get('/api/templates');
      templates.value = res.data;
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }

  async function fetchInventory() {
  }

  async function fetchAiUsage() {
    try {
      const res = await axios.get('/api/ai/usage');
      aiUsage.value = res.data;
    } catch (err) {
      console.error('Failed to fetch AI usage:', err);
    }
  }

  return {
    config, greenhouses, crops, weather, weatherHistory,
    initialized, loading,
    fetchConfig, fetchWeather, updateWeather, fetchWeatherHistory,
    fetchOperations, fetchTemplates, fetchInventory, fetchAiUsage
  };
});
