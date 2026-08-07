const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { findArray, generateFile } = require('../utils/CsvGenerator');

class CsvNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_CSV,
      name: 'Generate CSV',
      category: 'action',
      icon: '📊',
      description: 'Auto-discovers array datasets and exports formatted CSV files to storage',
      version: '1.0.0',
    });
  }

  async execute(node, context) {
    const prev = context.lastOutput;
    const delimiter = node.data?.delimiter || ',';
    const includeHeaders = node.data?.includeHeaders !== 'false';
    const customArrayPath = node.data?.arrayPath?.trim();

    const rows = findArray(prev, customArrayPath);

    if (!rows || rows.length === 0) {
      throw new Error('No dataset or records array found in previous step output');
    }

    // Determine column definitions
    let columnDefs = [];
    if (Array.isArray(node.data?.columns) && node.data.columns.length > 0) {
      columnDefs = node.data.columns;
    } else if (node.data?.fields) {
      columnDefs = node.data.fields.split(',').map(f => ({ header: f.trim(), value: `{{ ${f.trim()} }}` }));
    } else {
      const firstRow = rows[0] || {};
      columnDefs = Object.keys(firstRow).map(k => ({ header: k, value: `{{ ${k} }}` }));
    }

    const filename = node.data?.filename || 'attendance_report';

    return generateFile({
      rows,
      columnDefs,
      delimiter,
      includeHeaders,
      filename,
    });
  }
}

module.exports = CsvNode;
