import path from 'path';
import { readYaml, writeYaml, deepMerge } from './yamlUtils.js';
import fs from 'fs';
import { KNOWLEDGE_SYSTEM_DIR, KNOWLEDGE_USER_DIR } from './paths.js';

const SYSTEM_DIR = KNOWLEDGE_SYSTEM_DIR;
const USER_DIR = KNOWLEDGE_USER_DIR;

// In-memory cache for loaded knowledge
let knowledgeCache = {};
let cacheTimestamps = {};

/**
 * Load a knowledge file, merging system and user data.
 * @param {string} relativePath - e.g. 'crops/番茄.yml'
 * @returns {object|null} merged data
 */
export function loadKnowledge(relativePath) {
  const systemPath = path.join(SYSTEM_DIR, relativePath);
  const userPath = path.join(USER_DIR, relativePath);

  const systemData = readYaml(systemPath);
  const userData = readYaml(userPath);

  if (!systemData && !userData) return null;
  return deepMerge(systemData || {}, userData || {});
}

/**
 * Load all files in a knowledge subdirectory, merging system and user.
 * @param {string} subDir - e.g. 'crops', 'diseases/番茄'
 * @returns {object} map of filename (without extension) to data
 */
export function loadKnowledgeDir(subDir) {
  const result = {};

  const systemDirPath = path.join(SYSTEM_DIR, subDir);
  const userDirPath = path.join(USER_DIR, subDir);

  // Load system files
  if (fs.existsSync(systemDirPath)) {
    const files = fs.readdirSync(systemDirPath).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const name = file.replace(/\.ya?ml$/, '');
      const data = readYaml(path.join(systemDirPath, file));
      if (data) result[name] = data;
    }
  }

  // Merge user files
  if (fs.existsSync(userDirPath)) {
    const files = fs.readdirSync(userDirPath).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const name = file.replace(/\.ya?ml$/, '');
      const data = readYaml(path.join(userDirPath, file));
      if (data) {
        if (result[name]) {
          result[name] = deepMerge(result[name], data);
        } else {
          result[name] = data;
        }
      }
    }
  }

  return result;
}

/**
 * Save a user knowledge file. Auto-backup before overwrite.
 */
export function saveUserKnowledge(relativePath, data) {
  const filePath = path.join(USER_DIR, relativePath);
  const backupDir = path.join(USER_DIR, '_backups');

  // Auto-backup if file exists
  if (fs.existsSync(filePath)) {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${relativePath.replace(/\//g, '_')}_${timestamp}.yml`;
    fs.copyFileSync(filePath, path.join(backupDir, backupName));

    // Keep only last 2 backups per file
    const prefix = relativePath.replace(/\//g, '_');
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(prefix))
      .sort()
      .reverse();
    for (const old of backups.slice(2)) {
      fs.unlinkSync(path.join(backupDir, old));
    }
  }

  return writeYaml(filePath, data);
}

/**
 * Delete a user knowledge file. Cannot delete system files.
 */
export function deleteUserKnowledge(relativePath) {
  const filePath = path.join(USER_DIR, relativePath);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Check if a knowledge file is a system file.
 */
export function isSystemKnowledge(relativePath) {
  return fs.existsSync(path.join(SYSTEM_DIR, relativePath));
}

/**
 * Clear the knowledge cache.
 */
export function clearCache() {
  knowledgeCache = {};
  cacheTimestamps = {};
}
