import { Router } from 'express';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { readCsv, writeCsv, exportCsv } from '../services/csvUtils.js';
import { readYaml, writeYaml } from '../services/yamlUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RECORDS_DIR = path.join(__dirname, '..', 'data', 'records');
const EXPERIMENTS_DIR = path.join(__dirname, '..', 'data', 'experiments');
const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.yml');
const CUSTOM_METRICS_PATH = path.join(__dirname, '..', 'data', 'custom_metrics.yml');

const DEFAULT_COLUMNS = [
  '日期', '品种', '品种名', '株高(cm)', '叶片数(片)', '茎粗(mm)',
  '花朵数(个)', '坐果数(个)', '单果重(g)', '采收果数(个)',
  '采收总重(kg)', '棚温(°C)', '棚湿(%)', '备注'
];

const router = Router();

function getCustomMetrics() {
  return readYaml(CUSTOM_METRICS_PATH) || [];
}

function getConfig() { return readYaml(CONFIG_PATH) || {}; }

function getCsvPath(greenhouseName) {
  return path.join(RECORDS_DIR, `${greenhouseName}.csv`);
}

// GET /api/data-records
router.get('/', (req, res) => {
  const greenhouse = req.query.greenhouse;
  const cropType = req.query.crop_type;
  const cropName = req.query.crop_name;
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;

  if (!greenhouse) return res.status(400).json({ error: '请指定棚区' });

  const csvPath = getCsvPath(greenhouse);
  let records = readCsv(csvPath);

  if (cropType) records = records.filter(r => r['品种'] === cropType);
  if (cropName) records = records.filter(r => r['品种名'] === cropName);
  if (startDate) records = records.filter(r => r['日期'] >= startDate);
  if (endDate) records = records.filter(r => r['日期'] <= endDate);

  res.json(records);
});

// GET /api/data-records/last-values
router.get('/last-values', (req, res) => {
  const { greenhouse, crop_type, crop_name } = req.query;
  if (!greenhouse) return res.status(400).json({ error: '请指定棚区' });

  const csvPath = getCsvPath(greenhouse);
  const records = readCsv(csvPath);

  // Filter for the specific crop and get last record
  let filtered = records;
  if (crop_type) filtered = filtered.filter(r => r['品种'] === crop_type);
  if (crop_name) filtered = filtered.filter(r => r['品种名'] === crop_name);

  const lastRecord = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  res.json(lastRecord || {});
});

// POST /api/data-records
router.post('/', (req, res) => {
  const { greenhouse, crop_type, crop_name, date, values } = req.body;

  if (!greenhouse) return res.status(400).json({ error: '请选择棚区' });
  if (!crop_type) return res.status(400).json({ error: '请选择品种' });
  if (!date) return res.status(400).json({ error: '请选择日期' });

  const csvPath = getCsvPath(greenhouse);
  const customMetrics = getCustomMetrics();

  // Build column headers (default + custom)
  const customCols = customMetrics.map(m => m.name);
  const allColumns = [...DEFAULT_COLUMNS.slice(0, -1), ...customCols, '备注'];

  // Build record row
  const record = {
    '日期': date,
    '品种': crop_type,
    '品种名': crop_name || '',
    '株高(cm)': values?.plant_height ?? '',
    '叶片数(片)': values?.leaf_count ?? '',
    '茎粗(mm)': values?.stem_diameter ?? '',
    '花朵数(个)': values?.flower_count ?? '',
    '坐果数(个)': values?.fruit_count ?? '',
    '单果重(g)': values?.fruit_weight ?? '',
    '采收果数(个)': values?.harvest_count ?? '',
    '采收总重(kg)': values?.harvest_weight ?? '',
    '棚温(°C)': values?.greenhouse_temp ?? '',
    '棚湿(%)': values?.greenhouse_humidity ?? '',
    '备注': values?.note ?? ''
  };

  // Add custom metric values
  for (const metric of customMetrics) {
    record[metric.name] = values?.[metric.name] ?? values?.custom?.[metric.name] ?? '';
  }

  // Write CSV (append mode)
  writeCsv(csvPath, [record], allColumns, true);

  res.status(201).json({ success: true, record });
});

// GET /api/data-records/export
router.get('/export', (req, res) => {
  const { greenhouse, crop_type, crop_name, start_date, end_date } = req.query;

  if (greenhouse) {
    const csvPath = getCsvPath(greenhouse);
    let records = readCsv(csvPath);
    if (crop_type) records = records.filter(r => r['品种'] === crop_type);
    if (crop_name) records = records.filter(r => r['品种名'] === crop_name);
    if (start_date) records = records.filter(r => r['日期'] >= start_date);
    if (end_date) records = records.filter(r => r['日期'] <= end_date);

    const columns = records.length > 0 ? Object.keys(records[0]) : DEFAULT_COLUMNS;
    const csvContent = exportCsv(records, columns);

    const filename = [greenhouse, crop_type, crop_name, start_date, end_date].filter(Boolean).join('_') + '.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(csvContent);
  } else {
    let allRecords = [];
    let columns = DEFAULT_COLUMNS;

    if (fs.existsSync(RECORDS_DIR)) {
      const files = fs.readdirSync(RECORDS_DIR).filter(f => f.endsWith('.csv'));
      for (const file of files) {
        const records = readCsv(path.join(RECORDS_DIR, file));
        if (records.length > 0) {
          columns = Object.keys(records[0]);
          allRecords = allRecords.concat(records);
        }
      }
    }

    if (fs.existsSync(EXPERIMENTS_DIR)) {
      const expDirs = fs.readdirSync(EXPERIMENTS_DIR).filter(d => {
        return fs.statSync(path.join(EXPERIMENTS_DIR, d)).isDirectory();
      });
      for (const dir of expDirs) {
        const recordsDir = path.join(EXPERIMENTS_DIR, dir, 'records');
        if (!fs.existsSync(recordsDir)) continue;
        const csvFiles = fs.readdirSync(recordsDir).filter(f => f.endsWith('.csv'));
        for (const file of csvFiles) {
          const records = readCsv(path.join(recordsDir, file));
          if (records.length > 0) {
            for (const col of Object.keys(records[0])) {
              if (!columns.includes(col)) columns.push(col);
            }
            allRecords = allRecords.concat(records);
          }
        }
      }
    }

    const csvContent = exportCsv(allRecords, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('全部数据记录.csv')}`);
    res.send(csvContent);
  }
});

// GET /api/data-records/custom-metrics
router.get('/custom-metrics', (req, res) => {
  res.json(getCustomMetrics());
});

// POST /api/data-records/custom-metrics
router.post('/custom-metrics', (req, res) => {
  const { name, type, unit, options } = req.body;
  if (!name) return res.status(400).json({ error: '指标名称必填' });
  if (name.length > 30) return res.status(400).json({ error: '指标名称最多30个字' });

  const metrics = getCustomMetrics();
  if (metrics.some(m => m.name === name)) return res.status(400).json({ error: '指标名称已存在' });

  const metric = {
    id: uuidv4(),
    name,
    type: type || 'number', // number / select
    unit: unit || '',
    options: options || [],
    created_at: new Date().toISOString()
  };
  metrics.push(metric);
  writeYaml(CUSTOM_METRICS_PATH, metrics);
  res.status(201).json(metric);
});

// DELETE /api/data-records/custom-metrics/:id
router.delete('/custom-metrics/:id', (req, res) => {
  let metrics = getCustomMetrics();
  metrics = metrics.filter(m => m.id !== req.params.id);
  writeYaml(CUSTOM_METRICS_PATH, metrics);
  res.json({ success: true });
});

export default router;
