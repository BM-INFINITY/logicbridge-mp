const fs = require('fs');
const path = require('path');

/**
 * Recursively finds the primary Array in an object (e.g. records, data, items)
 * @param {object} obj - Source payload
 * @param {string} [customArrayPath] - Optional explicit array property key
 * @returns {Array} - Extracted array of data rows
 */
function findArray(obj, customArrayPath) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  if (customArrayPath && obj[customArrayPath] && Array.isArray(obj[customArrayPath])) {
    return obj[customArrayPath];
  }
  if (obj.records && Array.isArray(obj.records)) return obj.records;
  if (obj.data && Array.isArray(obj.data)) return obj.data;
  if (obj.items && Array.isArray(obj.items)) return obj.items;
  if (obj.results && Array.isArray(obj.results)) return obj.results;
  if (obj.data && typeof obj.data === 'object') {
    const nested = findArray(obj.data, customArrayPath);
    if (nested.length > 0) return nested;
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return typeof obj === 'object' ? [obj] : [];
}

/**
 * Formats a single CSV cell, escaping quotes and delimiters
 * @param {any} val - Cell value
 * @param {string} delimiter - Delimiter character
 * @returns {string} - Formatted CSV cell
 */
function formatCell(val, delimiter = ',') {
  const str = String(val ?? '');
  if (str.includes(delimiter) || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Resolves value expression for a specific record row
 * @param {string} expr - Expression string e.g. {{ Enrollment No. }}
 * @param {object} row - Row object
 * @returns {string} - Resolved value string
 */
function getValueForRow(expr, row) {
  if (!expr) return '';
  return expr.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawKey) => {
    const cleanKey = rawKey.replace(/^(step_\w+|prev|records|data)\./, '').trim();
    let val = row[cleanKey];
    if (val === undefined) {
      val = row[rawKey.trim()];
    }
    if (val === undefined) {
      const matchedKey = Object.keys(row).find(k => k.toLowerCase() === cleanKey.toLowerCase());
      if (matchedKey) val = row[matchedKey];
    }
    return val !== undefined ? String(val) : '';
  });
}

/**
 * Generates CSV content string and writes file to /exports directory
 * @param {object} params
 * @param {Array} params.rows - Dataset rows
 * @param {Array} params.columnDefs - Column header definitions
 * @param {string} params.delimiter - Delimiter character
 * @param {boolean} params.includeHeaders - Header inclusion flag
 * @param {string} params.filename - Base filename
 * @returns {object} - Generation metadata and CSV content
 */
function generateFile({ rows, columnDefs, delimiter = ',', includeHeaders = true, filename = 'report' }) {
  const lines = [];
  if (includeHeaders) {
    lines.push(columnDefs.map(c => formatCell(c.header, delimiter)).join(delimiter));
  }

  rows.forEach(row => {
    const line = columnDefs.map(c => {
      const cellValue = getValueForRow(c.value, row);
      return formatCell(cellValue, delimiter);
    }).join(delimiter);
    lines.push(line);
  });

  const csvContent = lines.join('\n');
  const timestamp = new Date().toISOString().slice(0, 10);
  const finalFilename = `${filename}_${timestamp}.csv`;

  const exportsDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
  const filePath = path.join(exportsDir, finalFilename);
  fs.writeFileSync(filePath, csvContent, 'utf8');

  return {
    filename: finalFilename,
    filePath,
    rowCount: rows.length,
    columnsCount: columnDefs.length,
    headers: columnDefs.map(c => c.header),
    csvPreview: csvContent.slice(0, 800) + (csvContent.length > 800 ? '...' : ''),
    csvContent,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  findArray,
  formatCell,
  getValueForRow,
  generateFile,
  generateCsvFile: generateFile,
};
