/**
 * Centralized path resolution for the agri-expert server.
 * 
 * In local dev mode: everything under server/
 * In Capacitor NodeJS (APK): 
 *   - knowledge/system/ → bundled assets (read-only)
 *   - data/ + knowledge/user/ → writable app storage
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server root — the directory containing index.js
export const SERVER_ROOT = join(__dirname, '..');

// Detect Capacitor NodeJS runtime
let _isCapacitor = false;
let _appDataRoot = null;

try {
  // The 'bridge' module is a built-in only available in the capacitor-nodejs runtime
  const require = createRequire(import.meta.url);
  require('bridge');
  _isCapacitor = true;
} catch (e) {
  // Not running in Capacitor NodeJS — local dev mode
}

if (_isCapacitor) {
  // Use os.homedir() — in Node.js for Mobile Apps this returns
  // a writable app-private directory (e.g. /data/data/<pkg>/files)
  _appDataRoot = join(os.homedir(), 'agri-expert');
  console.log('[Paths] Capacitor NodeJS detected, data root:', _appDataRoot);
} else {
  console.log('[Paths] Local dev mode, data root:', SERVER_ROOT);
}

// ── Static files (frontend build) ──
export const STATIC_DIR = _isCapacitor
  ? join(SERVER_ROOT, '..')
  : join(SERVER_ROOT, '..', 'client', 'dist');

// ── Writable data directories ──
export const DATA_DIR = _appDataRoot
  ? join(_appDataRoot, 'data')
  : join(SERVER_ROOT, 'data');

// ── Knowledge directories ──
export const KNOWLEDGE_SYSTEM_DIR = join(SERVER_ROOT, 'knowledge', 'system');
export const KNOWLEDGE_USER_DIR = _appDataRoot
  ? join(_appDataRoot, 'knowledge', 'user')
  : join(SERVER_ROOT, 'knowledge', 'user');

// ── Ensure writable directories exist ──
if (_appDataRoot) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(join(DATA_DIR, 'records'), { recursive: true });
  fs.mkdirSync(join(DATA_DIR, 'weather_history'), { recursive: true });
  fs.mkdirSync(join(DATA_DIR, 'experiments'), { recursive: true });
  fs.mkdirSync(KNOWLEDGE_USER_DIR, { recursive: true });
}
