import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

/**
 * Read a YAML file and parse it. Returns null if file doesn't exist.
 */
export function readYaml(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  } catch (err) {
    console.error(`YAML read error (${filePath}):`, err.message);
    return null;
  }
}

/**
 * Write data to a YAML file. Creates parent directories if needed.
 */
export function writeYaml(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = yaml.dump(data, { lineWidth: -1, noRefs: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (err) {
    console.error(`YAML write error (${filePath}):`, err.message);
    return false;
  }
}

/**
 * Deep merge two objects. Lists are concatenated with dedup (by JSON string).
 */
export function deepMerge(target, source) {
  if (!source) return target;
  if (!target) return source;
  
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else if (Array.isArray(source[key])) {
      if (Array.isArray(result[key])) {
        const existing = new Set(result[key].map(item =>
          typeof item === 'object' ? JSON.stringify(item) : item
        ));
        for (const item of source[key]) {
          const key2 = typeof item === 'object' ? JSON.stringify(item) : item;
          if (!existing.has(key2)) {
            result[key].push(item);
            existing.add(key2);
          }
        }
      } else {
        result[key] = [...source[key]];
      }
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}
