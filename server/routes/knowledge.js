import { Router } from 'express';
import { loadKnowledge, loadKnowledgeDir } from '../services/knowledgeLoader.js';
import { readYaml } from '../services/yamlUtils.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import yaml from 'js-yaml';
import archiver from 'archiver';
import multer from 'multer';
import unzipper from 'unzipper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const userDir = path.join(__dirname, '..', 'knowledge', 'user');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// GET /api/knowledge/diseases - search diseases
router.get('/diseases', (req, res) => {
  const { q, crop, family } = req.query;
  
  let crops = [];
  if (crop) {
    crops = [crop];
  } else if (family) {
    const familyCrops = {
      '茄科': ['番茄', '辣椒', '茄子'],
      '葫芦科': ['黄瓜', '南瓜', '西葫芦', '苦瓜'],
      '十字花科': ['大白菜', '甘蓝', '花椰菜', '西兰花', '萝卜'],
      '叶菜类': ['生菜', '油菜', '菠菜', '芹菜', '空心菜', '茼蒿', '苋菜', '小白菜']
    };
    crops = familyCrops[family] || [];
  } else {
    // Load crops from both system and user directories
    const systemDiseasesDir = path.join(__dirname, '..', 'knowledge', 'system', 'diseases');
    const userDiseasesDir = path.join(userDir, 'diseases');
    
    const cropSet = new Set();
    
    if (fs.existsSync(systemDiseasesDir)) {
      fs.readdirSync(systemDiseasesDir).filter(f => {
        const stat = fs.statSync(path.join(systemDiseasesDir, f));
        return stat.isDirectory();
      }).forEach(c => cropSet.add(c));
    }
    
    if (fs.existsSync(userDiseasesDir)) {
      fs.readdirSync(userDiseasesDir).filter(f => {
        const stat = fs.statSync(path.join(userDiseasesDir, f));
        return stat.isDirectory();
      }).forEach(c => cropSet.add(c));
    }
    
    crops = [...cropSet];
  }
  
  let results = [];

  for (const cropName of crops) {
    const cropDiseases = loadKnowledgeDir(`diseases/${cropName}`);
    for (const [key, disease] of Object.entries(cropDiseases)) {
      // Search by name, alias, symptoms
      if (q) {
        const query = q.toLowerCase();
        const searchable = [
          disease.name,
          disease.alias,
          disease.pathogen_name,
          ...(Object.values(disease.symptoms || {}).flat())
        ].filter(Boolean).join(' ').toLowerCase();

        if (!searchable.includes(query)) continue;
      }

      results.push({
        ...disease,
        crop: cropName,
        key,
        userDefined: !fs.existsSync(path.join(__dirname, '..', 'knowledge', 'system', 'diseases', cropName, `${key}.yml`))
      });
    }
  }

  res.json(results);
});

// GET /api/knowledge/diseases/:crop/:name - get disease detail
router.get('/diseases/:crop/:name', (req, res) => {
  const data = loadKnowledge(`diseases/${req.params.crop}/${req.params.name}.yml`);
  if (!data) return res.status(404).json({ error: '病害数据不存在' });
  res.json(data);
});

// GET /api/knowledge/pesticides - search pesticides
router.get('/pesticides', (req, res) => {
  const { q, type } = req.query;
  
  // Load system pesticides from safety_data.yml
  const data = loadKnowledge('pesticides/safety_data.yml');
  let pesticides = [...(data?.pesticides || [])];
  
  // Load user pesticides from individual files
  const userPesticidesDir = path.join(userDir, 'pesticides');
  if (fs.existsSync(userPesticidesDir)) {
    const files = fs.readdirSync(userPesticidesDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(userPesticidesDir, file);
      const userData = readYaml(filePath);
      if (userData && userData.name) {
        // Check if already exists in system pesticides
        const existingIdx = pesticides.findIndex(p => p.name === userData.name);
        if (existingIdx >= 0) {
          // Merge with existing
          pesticides[existingIdx] = { ...pesticides[existingIdx], ...userData, userDefined: true };
        } else {
          // Add new user pesticide
          pesticides.push({ ...userData, userDefined: true });
        }
      }
    }
  }

  if (q) {
    const query = q.toLowerCase();
    pesticides = pesticides.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.type.toLowerCase().includes(query) ||
      (p.control_targets || []).some(t => t.toLowerCase().includes(query))
    );
  }

  if (type) {
    pesticides = pesticides.filter(p => p.type === type);
  }

  res.json(pesticides);
});

// GET /api/knowledge/pesticides/:name - get pesticide detail
router.get('/pesticides/:name', (req, res) => {
  // Load system pesticides
  const data = loadKnowledge('pesticides/safety_data.yml');
  let pesticide = data?.pesticides?.find(p => p.name === req.params.name);
  
  // If not found in system, check user files
  if (!pesticide) {
    const userPesticidesDir = path.join(userDir, 'pesticides');
    if (fs.existsSync(userPesticidesDir)) {
      const files = fs.readdirSync(userPesticidesDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const file of files) {
        const filePath = path.join(userPesticidesDir, file);
        const userData = readYaml(filePath);
        if (userData && userData.name === req.params.name) {
          pesticide = { ...userData, userDefined: true };
          break;
        }
      }
    }
  }
  
  if (!pesticide) return res.status(404).json({ error: '农药数据不存在' });
  res.json(pesticide);
});

// GET /api/knowledge/crops/:type - get crop knowledge
router.get('/crops/:type', (req, res) => {
  // Load system crop data
  let data = loadKnowledge(`crops/${req.params.type}.yml`);
  
  // If not found in system, check user files
  if (!data) {
    const userCropDir = path.join(userDir, 'crops');
    const userFilePath = path.join(userCropDir, `${req.params.type}.yml`);
    if (fs.existsSync(userFilePath)) {
      data = readYaml(userFilePath);
      if (data) data.userDefined = true;
    }
  }
  
  if (!data) return res.status(404).json({ error: '作物数据不存在' });
  res.json(data);
});

// GET /api/knowledge/varieties/:crop - get varieties for a crop
router.get('/varieties/:crop', (req, res) => {
  // Load system varieties
  let data = loadKnowledge(`varieties/${req.params.crop}_varieties.yml`);
  
  // If not found in system, check user files
  if (!data) {
    const userVarietiesDir = path.join(userDir, 'varieties');
    const userFilePath = path.join(userVarietiesDir, `${req.params.crop}_varieties.yml`);
    if (fs.existsSync(userFilePath)) {
      data = readYaml(userFilePath);
    }
  }
  
  if (!data) return res.json([]);
  res.json(data.varieties || []);
});

// GET /api/knowledge/taxonomy/:family - get family knowledge
router.get('/taxonomy/:family', (req, res) => {
  const data = loadKnowledge(`taxonomy/${req.params.family}.yml`);
  if (!data) return res.status(404).json({ error: '科属数据不存在' });
  res.json(data);
});


// POST /api/knowledge/user - Add user knowledge file
router.post('/user', async (req, res) => {
  const { type, name, content } = req.body;
  if (!type || !name || !content) return res.status(400).json({ error: '请填写完整信息' });
  
  try {
    const yaml = await import('js-yaml');
    const data = yaml.load(content);
    if (!data) return res.status(400).json({ error: 'YAML 格式错误' });
    
    const { saveUserKnowledge } = await import('../services/knowledgeLoader.js');
    
    let relativePath;
    
    // 根据类型确定保存路径
    if (type === 'diseases') {
      // 病虫害需要按作物分类保存
      const crops = data.crops || [];
      if (crops.length > 0) {
        // 保存到第一个危害作物的目录下
        relativePath = `diseases/${crops[0]}/${name}.yml`;
      } else {
        // 如果没有指定作物，保存到"其他"目录
        relativePath = `diseases/其他/${name}.yml`;
      }
    } else if (type === 'varieties') {
      // 品种库按作物名保存
      const crop = data.crop || name;
      relativePath = `varieties/${crop}_varieties.yml`;
    } else {
      // 其他类型直接保存
      relativePath = `${type}/${name}.yml`;
    }
    
    saveUserKnowledge(relativePath, data);
    res.json({ 
      success: true, 
      path: relativePath,
      message: '保存成功，请点击"加载知识"按钮使其生效'
    });
  } catch (err) {
    res.status(400).json({ error: '保存失败: ' + err.message });
  }
});

// POST /api/knowledge/reload - Reload user knowledge
router.post('/reload', async (req, res) => {
  try {
    // 清除知识缓存（如果有缓存机制）
    const knowledgeLoader = await import('../services/knowledgeLoader.js');
    if (knowledgeLoader.clearCache) {
      knowledgeLoader.clearCache();
    }
    
    // 扫描用户知识目录
    const userKnowledgeTypes = ['crops', 'diseases', 'pesticides', 'varieties', 'decision_rules'];
    const loadedFiles = [];
    
    for (const type of userKnowledgeTypes) {
      const typeDir = path.join(userDir, type);
      if (fs.existsSync(typeDir)) {
        const scanDir = (dir, prefix = '') => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            if (item.startsWith('_') || item.startsWith('.')) continue;
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              scanDir(fullPath, prefix ? `${prefix}/${item}` : item);
            } else if (item.endsWith('.yml') || item.endsWith('.yaml')) {
              loadedFiles.push(prefix ? `${prefix}/${item}` : item);
            }
          }
        };
        scanDir(typeDir, type);
      }
    }
    
    res.json({ 
      success: true, 
      message: '知识加载成功',
      count: loadedFiles.length,
      files: loadedFiles
    });
  } catch (err) {
    res.status(500).json({ error: '加载失败: ' + err.message });
  }
});

// GET /api/knowledge/user-files - List user knowledge files with details
router.get('/user-files', async (req, res) => {
  const files = [];
  const scanDir = (dir, prefix = '') => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('_') || item.startsWith('.')) continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, prefix ? `${prefix}/${item}` : item);
      } else if (item.endsWith('.yml') || item.endsWith('.yaml')) {
        const relativePath = prefix ? `${prefix}/${item}` : item;
        const type = relativePath.split('/')[0];
        const name = item.replace(/\.ya?ml$/, '');
        files.push({
          path: relativePath,
          name,
          type,
          size: stat.size,
          created: stat.birthtime,
          modified: stat.mtime
        });
      }
    }
  };
  scanDir(userDir);
  res.json(files);
});

// DELETE /api/knowledge/user/* - Delete user knowledge file (supports nested paths)
router.delete('/user/*', async (req, res) => {
  const relativePath = req.params[0];
  const filePath = path.join(userDir, relativePath);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }
  
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除失败: ' + err.message });
  }
});

// POST /api/knowledge/import - Import knowledge file
router.post('/import', async (req, res) => {
  const { type, content, overwrite } = req.body;
  if (!type || !content) {
    return res.status(400).json({ error: '请提供知识类型和内容' });
  }
  
  try {
    const data = yaml.load(content);
    if (!data) {
      return res.status(400).json({ error: 'YAML格式错误：无法解析内容' });
    }
    
    // Validate based on type
    const validation = validateKnowledgeData(type, data);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: '数据格式不符合要求',
        details: validation.errors,
        suggestion: '请检查必填字段，或参考系统内置知识格式手动修改'
      });
    }
    
    const name = data.name || data.名称;
    if (!name) {
      return res.status(400).json({ error: '缺少名称字段（name或名称）' });
    }
    
    const filePath = path.join(userDir, `${type}/${name}.yml`);
    
    // Check if file exists
    if (fs.existsSync(filePath) && !overwrite) {
      return res.status(409).json({ 
        error: '同名文件已存在',
        suggestion: '请启用覆盖选项，或修改名称后重试'
      });
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save file
    const yamlContent = yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true });
    fs.writeFileSync(filePath, yamlContent, 'utf8');
    
    res.json({ 
      success: true, 
      message: '导入成功',
      file: { name, type, path: `${type}/${name}.yml` }
    });
  } catch (err) {
    res.status(400).json({ 
      error: '导入失败: ' + err.message,
      suggestion: '请检查YAML语法是否正确，或手动输入知识内容'
    });
  }
});

// POST /api/knowledge/import-file - Import knowledge from file (ZIP or YAML)
router.post('/import-file', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const overwrite = req.body.overwrite === 'true';
  const originalName = req.file.originalname.toLowerCase();
  const isZip = originalName.endsWith('.zip');
  const isYaml = originalName.endsWith('.yml') || originalName.endsWith('.yaml');

  if (!isZip && !isYaml) {
    return res.status(400).json({ error: '仅支持 .zip、.yml、.yaml 文件' });
  }

  const knownTypes = ['crops', 'diseases', 'pesticides', 'varieties', 'decision_rules'];
  const imported = [];
  const errors = [];

  try {
    if (isZip) {
      const directory = await unzipper.Open.buffer(req.file.buffer);
      for (const entry of directory.files) {
        if (entry.type !== 'File') continue;
        if (entry.path.startsWith('__MACOSX') || entry.path.startsWith('.')) continue;
        if (!entry.path.endsWith('.yml') && !entry.path.endsWith('.yaml')) continue;

        const parts = entry.path.split('/');
        if (parts.length < 2) continue;
        const type = parts[0];
        if (!knownTypes.includes(type)) continue;

        const fileName = parts[parts.length - 1];
        const content = await entry.buffer();
        const text = content.toString('utf8');

        let data;
        try {
          data = yaml.load(text);
        } catch (e) {
          errors.push({ file: entry.path, error: 'YAML语法错误: ' + e.message });
          continue;
        }

        if (!data) {
          errors.push({ file: entry.path, error: '文件内容为空' });
          continue;
        }

        const name = fileName.replace(/\.ya?ml$/, '');
        const filePath = path.join(userDir, type, `${name}.yml`);

        if (fs.existsSync(filePath) && !overwrite) {
          errors.push({ file: entry.path, error: '同名文件已存在，跳过' });
          continue;
        }

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const yamlContent = yaml.dump(data, { indent: 2, lineWidth: -1, noRefs: true });
        fs.writeFileSync(filePath, yamlContent, 'utf8');
        imported.push({ name, type, path: `${type}/${name}.yml` });
      }
    } else {
      const text = req.file.buffer.toString('utf8');
      let data;
      try {
        data = yaml.load(text);
      } catch (e) {
        return res.status(400).json({ error: 'YAML语法错误: ' + e.message });
      }

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: '文件内容无效' });
      }

      for (const [type, items] of Object.entries(data)) {
        if (!knownTypes.includes(type)) continue;
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const name = item.name || item.名称;
          if (!name) {
            errors.push({ type, error: '缺少name字段，跳过' });
            continue;
          }

          const filePath = path.join(userDir, type, `${name}.yml`);
          if (fs.existsSync(filePath) && !overwrite) {
            errors.push({ type, name, error: '同名文件已存在，跳过' });
            continue;
          }

          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          const yamlContent = yaml.dump(item, { indent: 2, lineWidth: -1, noRefs: true });
          fs.writeFileSync(filePath, yamlContent, 'utf8');
          imported.push({ name, type, path: `${type}/${name}.yml` });
        }
      }
    }

    if (imported.length === 0 && errors.length > 0) {
      return res.status(400).json({
        error: '导入失败',
        details: errors
      });
    }

    res.json({
      success: true,
      imported,
      errors,
      message: `成功导入 ${imported.length} 个文件${errors.length > 0 ? `，${errors.length} 个失败` : ''}`
    });
  } catch (err) {
    res.status(400).json({
      error: '文件处理失败: ' + err.message,
      suggestion: '请确认文件格式正确'
    });
  }
});

// GET /api/knowledge/export - Export knowledge files
router.get('/export', async (req, res) => {
  const { types, format } = req.query;
  
  if (!types) {
    return res.status(400).json({ error: '请指定要导出的知识类型' });
  }
  
  const typeList = types.split(',');
  const files = [];
  
  // Collect files
  for (const type of typeList) {
    const typeDir = path.join(userDir, type);
    if (!fs.existsSync(typeDir)) continue;
    
    const items = fs.readdirSync(typeDir);
    for (const item of items) {
      if (item.startsWith('_') || item.startsWith('.')) continue;
      if (!item.endsWith('.yml') && !item.endsWith('.yaml')) continue;
      
      const fullPath = path.join(typeDir, item);
      const content = fs.readFileSync(fullPath, 'utf8');
      files.push({
        name: item,
        type,
        content
      });
    }
  }
  
  if (files.length === 0) {
    return res.status(404).json({ error: '没有找到可导出的文件' });
  }
  
  if (format === 'single') {
    // Merge into single YAML
    const merged = {};
    for (const file of files) {
      const data = yaml.load(file.content);
      if (!merged[file.type]) merged[file.type] = [];
      merged[file.type].push(data);
    }
    
    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', 'attachment; filename=knowledge-export.yml');
    res.send(yaml.dump(merged, { indent: 2, lineWidth: -1 }));
  } else {
    // ZIP format
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=knowledge-export.zip');
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    
    for (const file of files) {
      archive.append(file.content, { name: `${file.type}/${file.name}` });
    }
    
    archive.finalize();
  }
});

// GET /api/knowledge/validate/:type - Validate YAML content for type
router.post('/validate/:type', (req, res) => {
  const { type } = req.params;
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: '请提供要验证的内容' });
  }
  
  try {
    const data = yaml.load(content);
    if (!data) {
      return res.status(400).json({ valid: false, errors: ['YAML格式错误：无法解析内容'] });
    }
    
    const validation = validateKnowledgeData(type, data);
    res.json(validation);
  } catch (err) {
    res.status(400).json({ valid: false, errors: ['YAML语法错误: ' + err.message] });
  }
});

// Validation helper function
function validateKnowledgeData(type, data) {
  const errors = [];
  
  switch (type) {
    case 'crops':
      if (!data.name && !data.名称) errors.push('缺少作物名称（name或名称）');
      if (!data.family && !data.科属) errors.push('缺少科属（family或科属）');
      if (!data.stages && !data.生长阶段) errors.push('缺少生长阶段（stages或生长阶段）');
      if (data.stages && !Array.isArray(data.stages)) errors.push('生长阶段必须是数组');
      if (data.stages) {
        data.stages.forEach((stage, idx) => {
          if (!stage.name && !stage.名称) errors.push(`阶段${idx + 1}缺少名称`);
          if (stage.order === undefined && stage.顺序 === undefined) errors.push(`阶段${idx + 1}缺少顺序`);
        });
      }
      break;
      
    case 'diseases':
      if (!data.name && !data.名称) errors.push('缺少病虫害名称（name或名称）');
      if (!data.pathogen_type && !data.类型) errors.push('缺少类型（pathogen_type或类型）');
      if (!data.symptoms && !data.症状) errors.push('缺少症状描述（symptoms或症状）');
      break;
      
    case 'pesticides':
      // Pesticides can be single or array
      const pesticideList = Array.isArray(data) ? data : (data.pesticides || [data]);
      pesticideList.forEach((p, idx) => {
        if (!p.name && !p.名称) errors.push(`农药${idx + 1}缺少名称`);
        if (!p.type && !p.类型) errors.push(`农药${idx + 1}缺少类型`);
      });
      break;
      
    case 'varieties':
      if (!data.varieties && !data.品种) errors.push('缺少品种列表（varieties或品种）');
      break;
      
    case 'decision_rules':
      // Rules are more flexible, just check it's valid YAML
      break;
      
    default:
      errors.push('不支持的知识类型: ' + type);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// POST /api/knowledge/convert - Convert Chinese field names to system format
router.post('/convert', (req, res) => {
  const { type, data } = req.body;
  
  if (!type || !data) {
    return res.status(400).json({ error: '请提供类型和数据' });
  }
  
  try {
    const converted = convertChineseFields(type, data);
    res.json({ success: true, data: converted });
  } catch (err) {
    res.status(400).json({ error: '转换失败: ' + err.message });
  }
});

// Convert Chinese field names to system format
function convertChineseFields(type, data) {
  const fieldMap = {
    common: {
      '名称': 'name',
      '别名': 'alias',
      '描述': 'description',
      '类型': 'type'
    },
    crops: {
      '科属': 'family',
      '学名': 'latin_name',
      '全生育期': 'total_days',
      '生长阶段': 'stages',
      '病虫害': 'diseases',
      '顺序': 'order',
      '天数': 'typical_days',
      '要点': 'key_points',
      '温度': 'temperature',
      '浇水': 'watering',
      '施肥': 'fertilization',
      '监测': 'pest_watch',
      '白天': 'day',
      '夜间': 'night'
    },
    diseases: {
      '病原类型': 'pathogen_type',
      '病原名称': 'pathogen_name',
      '危害作物': 'crops',
      '症状': 'symptoms',
      '叶片': 'leaf',
      '茎秆': 'stem',
      '植株': 'plant',
      '发病条件': 'conditions',
      '农业防治': 'agricultural_control',
      '化学防治': 'chemical_control',
      '物理防治': 'physical_control',
      '生物防治': 'biological_control'
    },
    pesticides: {
      '有效成分': 'active_ingredient',
      '安全间隔期': 'safety_interval_days',
      '适用作物': 'applicable_crops',
      '防治对象': 'control_targets',
      '稀释倍数': 'dilution',
      '用量': 'dosage',
      '禁忌': 'contraindications'
    }
  };
  
  const map = { ...fieldMap.common, ...(fieldMap[type] || {}) };
  
  const convert = (obj) => {
    if (Array.isArray(obj)) {
      return obj.map(item => convert(item));
    }
    
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = map[key] || key;
      result[newKey] = convert(value);
    }
    return result;
  };
  
  return convert(data);
}

export default router;
