import { Router } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import archiver from 'archiver';
import { readYaml, writeYaml } from '../services/yamlUtils.js';
import { readCsv, writeCsv } from '../services/csvUtils.js';
import { DATA_DIR } from '../services/paths.js';

const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');
const BOM = '\uFEFF';

const router = Router();

function sanitizeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
}

function getExpDir(id, name) {
  return path.join(EXPERIMENTS_DIR, `${id}_${sanitizeName(name)}`);
}

function getMetaPath(expDir) {
  return path.join(expDir, 'meta.yml');
}

function getRecordsDir(expDir) {
  return path.join(expDir, 'records');
}

function getRecordPath(expDir, date, expName) {
  const prefix = expName ? sanitizeName(expName) + '-' : '';
  return path.join(getRecordsDir(expDir), `${prefix}${date}.csv`);
}

function readMeta(expDir) {
  return readYaml(getMetaPath(expDir)) || null;
}

function writeMeta(expDir, data) {
  return writeYaml(getMetaPath(expDir), data);
}

function readRecordsCsv(filePath) {
  return readCsv(filePath);
}

function createBackupAndWrite(filePath, records, columns, maxBackups = 5) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const backupDir = path.join(dir, '_backups');
    if (fs.existsSync(filePath)) {
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = Date.now();
      const backupPath = path.join(backupDir, `${path.basename(filePath)}.${timestamp}.bak`);
      fs.copyFileSync(filePath, backupPath);

      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(path.basename(filePath)))
        .sort()
        .reverse();
      for (let i = maxBackups; i < backups.length; i++) {
        fs.unlinkSync(path.join(backupDir, backups[i]));
      }
    }

    writeCsv(filePath, records, columns, false);
    return true;
  } catch (err) {
    console.error(`CSV write error (${filePath}):`, err.message);
    return false;
  }
}

function listExperiments() {
  if (!fs.existsSync(EXPERIMENTS_DIR)) return [];
  const dirs = fs.readdirSync(EXPERIMENTS_DIR).filter(d => {
    return fs.statSync(path.join(EXPERIMENTS_DIR, d)).isDirectory();
  });
  const experiments = [];
  for (const dir of dirs) {
    const expDir = path.join(EXPERIMENTS_DIR, dir);
    const meta = readMeta(expDir);
    if (meta) {
      const recordsDir = getRecordsDir(expDir);
      let dates = [];
      if (fs.existsSync(recordsDir)) {
        const namePrefix = sanitizeName(meta.name) + '-';
        dates = fs.readdirSync(recordsDir)
          .filter(f => f.endsWith('.csv'))
          .map(f => {
            let d = f.replace('.csv', '');
            if (d.startsWith(namePrefix)) d = d.slice(namePrefix.length);
            return d;
          })
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      }
      experiments.push({
        ...meta,
        dates,
        lastDate: dates.length > 0 ? dates[dates.length - 1] : null
      });
    }
  }
  experiments.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return experiments;
}

function getExpById(id) {
  if (!fs.existsSync(EXPERIMENTS_DIR)) return null;
  const dirs = fs.readdirSync(EXPERIMENTS_DIR).filter(d => d.startsWith(id));
  if (dirs.length === 0) return null;
  const expDir = path.join(EXPERIMENTS_DIR, dirs[0]);
  const meta = readMeta(expDir);
  if (!meta) return null;
  return { ...meta, _dir: expDir };
}

// GET /api/experiments
router.get('/', (req, res) => {
  res.json(listExperiments());
});

// POST /api/experiments
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入试验名称' });
  if (name.length > 100) return res.status(400).json({ error: '试验名称最多100个字' });

  const id = `exp_${Date.now()}_${uuidv4().slice(0, 4)}`;
  const meta = {
    id,
    name: name.trim(),
    metrics: [],
    treatments: [],
    created_at: new Date().toISOString()
  };

  const expDir = getExpDir(id, name.trim());
  fs.mkdirSync(getRecordsDir(expDir), { recursive: true });
  writeMeta(expDir, meta);

  res.status(201).json(meta);
});

// GET /api/experiments/:id
router.get('/:id', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const recordsDir = getRecordsDir(exp._dir);
  let dates = [];
  if (fs.existsSync(recordsDir)) {
    dates = fs.readdirSync(recordsDir)
      .filter(f => f.endsWith('.csv'))
      .map(f => f.replace('.csv', ''))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  const { _dir, ...clean } = exp;
  res.json({ ...clean, dates });
});

// PUT /api/experiments/:id
router.put('/:id', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const { greenhouse, crop } = req.body;
  if (greenhouse !== undefined) exp.greenhouse = greenhouse;
  if (crop !== undefined) exp.crop = crop;

  const { _dir, ...meta } = exp;
  writeMeta(_dir, meta);
  res.json(meta);
});

// DELETE /api/experiments/:id
router.delete('/:id', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  fs.rmSync(exp._dir, { recursive: true, force: true });
  res.json({ success: true });
});

// POST /api/experiments/:id/metrics
router.post('/:id/metrics', (req, res) => {
  const { name, unit } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入指标名称' });
  if (name.length > 30) return res.status(400).json({ error: '指标名称最多30个字' });

  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  if (exp.metrics.some(m => m.name === name.trim())) {
    return res.status(400).json({ error: '指标名称已存在' });
  }

  const metric = {
    id: `m_${Date.now()}_${uuidv4().slice(0, 4)}`,
    name: name.trim(),
    unit: (unit || '').trim()
  };

  exp.metrics.push(metric);
  const { _dir, ...meta } = exp;
  writeMeta(_dir, meta);

  res.status(201).json(metric);
});

// GET /api/experiments/:id/metrics
router.get('/:id/metrics', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });
  res.json(exp.metrics || []);
});

// POST /api/experiments/:id/treatments
router.post('/:id/treatments', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入处理名称' });
  if (name.length > 30) return res.status(400).json({ error: '处理名称最多30个字' });

  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  if (exp.treatments.some(t => t.name === name.trim())) {
    return res.status(400).json({ error: '处理名称已存在' });
  }

  const treatment = {
    id: `t_${Date.now()}_${uuidv4().slice(0, 4)}`,
    name: name.trim()
  };

  exp.treatments.push(treatment);
  const { _dir, ...meta } = exp;
  writeMeta(_dir, meta);

  res.status(201).json(treatment);
});

// GET /api/experiments/:id/treatments
router.get('/:id/treatments', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });
  res.json(exp.treatments || []);
});

// GET /api/experiments/:id/dates
router.get('/:id/dates', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const recordsDir = getRecordsDir(exp._dir);
  let dates = [];
  if (fs.existsSync(recordsDir)) {
    const namePrefix = sanitizeName(exp.name) + '-';
    dates = fs.readdirSync(recordsDir)
      .filter(f => f.endsWith('.csv'))
      .map(f => {
        let d = f.replace('.csv', '');
        if (d.startsWith(namePrefix)) d = d.slice(namePrefix.length);
        return d;
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  res.json(dates);
});

// POST /api/experiments/:id/records
// Save a treatment's data for a specific date
router.post('/:id/records', (req, res) => {
  const { date, treatment_name, metric_values, note, record_id } = req.body;

  console.log(`[SERVER DEBUG] POST /records - date:${date}, treatment:${treatment_name}, recordId:${record_id}, metrics:`, JSON.stringify(metric_values));

  if (!date) return res.status(400).json({ error: '请选择测量日期' });
  if (!treatment_name) return res.status(400).json({ error: '请选择处理' });
  if (!metric_values || typeof metric_values !== 'object') {
    return res.status(400).json({ error: '请提供测量数据' });
  }

  for (const [key, values] of Object.entries(metric_values)) {
    const checkVal = (v) => {
      if (Array.isArray(v)) v.forEach(item => checkVal(item));
      else if (typeof v === 'string' && v.trim()) {
        const num = Number(v);
        if (!isNaN(num) && num < 0) return res.status(400).json({ error: `不允许负数值: ${v}` });
      }
    };
    checkVal(values);
    if (res.headersSent) return;
  }

  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const filePath = getRecordPath(exp._dir, date, exp.name);
  console.log(`[SERVER DEBUG] 文件路径: ${filePath}, 是否存在: ${fs.existsSync(filePath)}`);

  let existingRecords = readRecordsCsv(filePath);
  console.log(`[SERVER DEBUG] 已有记录数: ${existingRecords.length}`);

  const currentMetricNames = (exp.metrics || []).map(m => m.name + (m.unit ? `(${m.unit})` : ''));
  let allColumns = ['record_id', 'treatment', ...currentMetricNames, 'note', 'timestamp'];
  if (existingRecords.length > 0) {
    const existingCols = Object.keys(existingRecords[0]);
    for (const col of existingCols) {
      if (!allColumns.includes(col)) allColumns.push(col);
    }
  }

  const rid = record_id || `r_${Date.now()}_${uuidv4().slice(0, 4)}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log(`[SERVER DEBUG] 使用recordId: ${rid} (传入:${record_id || '无'})`);

  const newRecordData = { record_id: rid, treatment: treatment_name, note: note || '', timestamp };
  for (const metric of (exp.metrics || [])) {
    const colName = metric.name + (metric.unit ? `(${metric.unit})` : '');
    const values = metric_values[metric.id] || metric_values[metric.name] || [];
    newRecordData[colName] = Array.isArray(values) ? values.join(';') : String(values || '');
  }

  const existingIdx = existingRecords.findIndex(r => r.record_id === rid);
  console.log(`[SERVER DEBUG] 查找已有记录: idx=${existingIdx} (>=0表示更新, <0表示新建)`);

  if (existingIdx >= 0) {
    const existing = existingRecords[existingIdx];
    console.log(`[SERVER DEBUG] 更新记录 - 原数据:`, JSON.stringify(existing));
    for (const [key, value] of Object.entries(newRecordData)) {
      if (value !== undefined && value !== '') {
        existing[key] = value;
      }
    }
    existing.timestamp = timestamp;
    if (note !== undefined) existing.note = note || '';
    console.log(`[SERVER DEBUG] 更新后 - 新数据:`, JSON.stringify(existing));
  } else {
    existingRecords.push(newRecordData);
    console.log(`[SERVER DEBUG] 新建记录 - 数据:`, JSON.stringify(newRecordData));
  }

  console.log(`[SERVER DEBUG] 准备写入文件 - 总记录数: ${existingRecords.length}, 列:`, allColumns);
  const writeResult = createBackupAndWrite(filePath, existingRecords, allColumns);
  console.log(`[SERVER DEBUG] 写入结果: ${writeResult}, 文件是否存在: ${fs.existsSync(filePath)}`);

  res.status(201).json({ success: true, record_id: rid });
});

// GET /api/experiments/:id/records/:date
router.get('/:id/records/:date', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const filePath = getRecordPath(exp._dir, req.params.date, exp.name);
  const records = readRecordsCsv(filePath);
  res.json(records);
});

// DELETE /api/experiments/:id/records/:date
router.delete('/:id/records/:date', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const filePath = getRecordPath(exp._dir, req.params.date, exp.name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// DELETE /api/experiments/:id/records/:date/:recordId
router.delete('/:id/records/:date/:recordId', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const filePath = getRecordPath(exp._dir, req.params.date, exp.name);
  let records = readRecordsCsv(filePath);
  const before = records.length;
  records = records.filter(r => r.record_id !== req.params.recordId);

  if (records.length === before) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (records.length === 0) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } else {
    const metricNames = (exp.metrics || []).map(m => m.name + (m.unit ? `(${m.unit})` : ''));
    const columns = ['record_id', 'treatment', ...metricNames, 'note', 'timestamp'];
    createBackupAndWrite(filePath, records, columns);
  }

  res.json({ success: true });
});

// GET /api/experiments/:id/export
// ?dates=2026-05-26,2026-05-27 (comma-separated dates)
router.get('/:id/export', (req, res) => {
  const exp = getExpById(req.params.id);
  if (!exp) return res.status(404).json({ error: '试验不存在' });

  const datesParam = req.query.dates;
  let dates = [];
  if (datesParam) {
    dates = datesParam.split(',').map(d => d.trim()).filter(Boolean);
  } else {
    const recordsDir = getRecordsDir(exp._dir);
    if (fs.existsSync(recordsDir)) {
      dates = fs.readdirSync(recordsDir)
        .filter(f => f.endsWith('.csv'))
        .map(f => f.replace('.csv', ''))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }
  }

  if (dates.length === 0) {
    return res.status(400).json({ error: '没有可导出的数据' });
  }

  if (dates.length === 1) {
    const filePath = getRecordPath(exp._dir, dates[0], exp.name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '该日期无数据' });
    }
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith(BOM)) content = BOM + content;
    const filename = `${sanitizeName(exp.name)}_${dates[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(content);
  }

  res.setHeader('Content-Type', 'application/zip');
  const zipFilename = `${sanitizeName(exp.name)}_数据导出.zip`;
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipFilename)}`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => { throw err; });
  archive.pipe(res);

  for (const date of dates) {
    const filePath = getRecordPath(exp._dir, date, exp.name);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (!content.startsWith(BOM)) content = BOM + content;
      archive.append(content, { name: `${sanitizeName(exp.name)}_${date}.csv` });
    }
  }

  archive.finalize();
});

export default router;
