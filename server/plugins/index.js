/**
 * Plugin Registry
 * Central registry for all plugin types:
 * - weather: Weather data sources (each implements fetchCurrent(lat, lon, city) => sourceData)
 * - knowledge: Knowledge data providers (each implements load(path) => data)
 * - operations: Operation type definitions (each defines name, icon, fields)
 * - dataModules: Data record modules (each defines metrics, columns)
 *
 * Plugins self-register at import time. New plugins just need to be
 * added to the appropriate directory and imported here.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PluginRegistry {
  constructor() {
    this.plugins = {
      weather: {},
      knowledge: {},
      operations: {},
      dataModules: {}
    };
  }

  /**
   * Register a plugin
   * @param {string} type - Plugin type (weather|knowledge|operations|dataModules)
   * @param {string} name - Plugin name (unique within type)
   * @param {object} plugin - Plugin implementation
   */
  register(type, name, plugin) {
    if (!this.plugins[type]) {
      console.warn(`[PluginRegistry] Unknown plugin type: ${type}`);
      return;
    }
    this.plugins[type][name] = plugin;
    console.log(`[PluginRegistry] Registered ${type} plugin: ${name}`);
  }

  /**
   * Get a specific plugin
   */
  get(type, name) {
    return this.plugins[type]?.[name] || null;
  }

  /**
   * Get all plugins of a type
   */
  getAll(type) {
    return this.plugins[type] || {};
  }

  /**
   * Get all plugin names of a type
   */
  getNames(type) {
    return Object.keys(this.plugins[type] || {});
  }

  /**
   * Auto-discover and load plugins from a directory
   */
  async discover(type, dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.startsWith('_'));
    for (const file of files) {
      try {
        const plugin = await import(join(dir, file));
        const name = file.replace(/\.js$/, '');
        if (plugin.default) {
          this.register(type, name, plugin.default);
        }
      } catch (err) {
        console.error(`[PluginRegistry] Failed to load plugin ${file}:`, err.message);
      }
    }
  }

  /**
   * Get status report of all plugins
   */
  getStatus() {
    const status = {};
    for (const [type, plugins] of Object.entries(this.plugins)) {
      status[type] = Object.keys(plugins).map(name => ({
        name,
        enabled: plugins[name].enabled !== false
      }));
    }
    return status;
  }
}

// Singleton instance
const registry = new PluginRegistry();

export default registry;

// ─── Built-in Plugin Registration ───────────────────────────────────

// Weather plugins are registered via their module files in plugins/weather/
// Knowledge plugins use the existing knowledgeLoader system
// Operation and data plugins register their type definitions

/**
 * Register built-in operation types
 */
registry.register('operations', 'core', {
  types: [
    { name: '施肥', icon: '🌿', fields: ['fertilizer_name', 'dosage', 'unit'] },
    { name: '打药', icon: '💧', fields: ['pesticide_name', 'dosage', 'unit', 'target', 'safety_interval'] },
    { name: '灌溉', icon: '💧', fields: ['duration', 'method'] },
    { name: '整枝打杈', icon: '✂️', fields: ['action'] },
    { name: '通风', icon: '🌬', fields: ['action', 'vent_position'] },
    { name: '授粉', icon: '🌸', fields: ['method'] },
    { name: '采收', icon: '🥬', fields: ['fruit_count', 'weight', 'weight_unit'] },
    { name: '环境记录', icon: '🌡', fields: ['temp', 'humidity'] },
    { name: '其他', icon: '📝', fields: ['description'] }
  ]
});

/**
 * Register built-in data record metrics
 */
registry.register('dataModules', 'default_metrics', {
  metrics: [
    { key: 'plant_height', label: '株高', unit: 'cm', type: 'number', step: 5, min: 0, max: 500 },
    { key: 'stem_diameter', label: '茎粗', unit: 'mm', type: 'number', step: 1, min: 0, max: 100 },
    { key: 'leaf_count', label: '叶片数', unit: '片', type: 'number', step: 1, min: 0, max: 100 },
    { key: 'flower_count', label: '花朵数', unit: '个', type: 'number', step: 1, min: 0, max: 100 },
    { key: 'fruit_count', label: '坐果数', unit: '个', type: 'number', step: 1, min: 0, max: 100 },
    { key: 'fruit_weight', label: '单果重', unit: 'g', type: 'number', step: 5, min: 0, max: 5000 },
    { key: 'harvest_count', label: '采收果数', unit: '个', type: 'number', step: 1, min: 0, max: 100 },
    { key: 'harvest_weight', label: '采收总重', unit: 'kg', type: 'number', step: 0.1, min: 0, max: 9999 },
    { key: 'greenhouse_temp', label: '棚内温度', unit: '°C', type: 'number', step: 1, min: -10, max: 60 },
    { key: 'greenhouse_humidity', label: '棚内湿度', unit: '%', type: 'number', step: 5, min: 0, max: 100 }
  ]
});
