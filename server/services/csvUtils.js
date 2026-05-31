import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const BOM = '\uFEFF';

/**
 * Read a CSV file and return array of objects. Returns empty array if file doesn't exist.
 */
export function readCsv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    return records;
  } catch (err) {
    console.error(`CSV read error (${filePath}):`, err.message);
    return [];
  }
}

/**
 * Write records to a CSV file with UTF-8 BOM. Creates parent directories if needed.
 * If append=true and file exists, merges existing data with new records,
 * expanding columns if needed, then rewrites the entire file.
 */
export function writeCsv(filePath, records, columns, append = false) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (append && fs.existsSync(filePath)) {
      // Read existing data and merge with new records
      const existingRecords = readCsv(filePath);
      const allRecords = [...existingRecords, ...records];
      // Collect all unique column names preserving order
      const allColumns = [...columns];
      for (const rec of allRecords) {
        for (const key of Object.keys(rec)) {
          if (!allColumns.includes(key)) allColumns.push(key);
        }
      }
      const mergedContent = stringify(allRecords, { header: true, columns: allColumns });
      fs.writeFileSync(filePath, BOM + mergedContent, 'utf8');
    } else {
      const csvContent = stringify(records, { header: true, columns });
      fs.writeFileSync(filePath, BOM + csvContent, 'utf8');
    }
    return true;
  } catch (err) {
    console.error(`CSV write error (${filePath}):`, err.message);
    return false;
  }
}

/**
 * Export CSV content as a downloadable string with BOM.
 */
export function exportCsv(records, columns) {
  const csvContent = stringify(records, {
    header: true,
    columns: columns
  });
  return BOM + csvContent;
}
