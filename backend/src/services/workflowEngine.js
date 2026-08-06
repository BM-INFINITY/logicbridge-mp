const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ─── Node Handler Registry ───────────────────────────────────────────────────
const handlers = {
  'trigger-manual': async (node, ctx) => {
    return {
      triggered: true,
      triggeredAt: new Date().toISOString(),
      message: 'Workflow started manually',
    };
  },

  'trigger-schedule': async (node, ctx) => {
    return { triggered: true, schedule: node.data?.cron || '', triggeredAt: new Date().toISOString() };
  },

  'action-http': async (node, ctx) => {
    let { url, method = 'GET', body = '', queryParamsList = [], headersList = [] } = node.data || {};
    if (!url) throw new Error('HTTP node requires a URL');

    const prev = ctx.lastOutput;

    // Resolver function for mustache tags {{ step_id.field }} or {{ prev.field }}
    const resolveExpr = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
        const cleanPath = path.replace(/^(step_\w+|prev)\./, '').trim();
        let val = cleanPath.split('.').reduce((o, k) => o?.[k], prev);
        if (val === undefined && prev?.data) {
          val = cleanPath.split('.').reduce((o, k) => o?.[k], prev.data);
        }
        return val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
      });
    };

    let resolvedUrl = resolveExpr(url);

    // Append queryParamsList if provided
    if (Array.isArray(queryParamsList) && queryParamsList.length > 0) {
      try {
        const urlObj = new URL(resolvedUrl);
        queryParamsList.forEach(qp => {
          if (qp.key && qp.key.trim()) {
            urlObj.searchParams.set(qp.key.trim(), resolveExpr(qp.value || ''));
          }
        });
        resolvedUrl = urlObj.toString();
      } catch (err) {
        console.warn('URL parsing skipped for queryParams:', err.message);
      }
    }

    // Build headers
    const customHeaders = { 'User-Agent': 'LogicBridge/1.0' };
    if (Array.isArray(headersList)) {
      headersList.forEach(h => {
        if (h.key && h.key.trim()) customHeaders[h.key.trim()] = resolveExpr(h.value || '');
      });
    }

    const response = await axios({
      method,
      url: resolvedUrl,
      data: body ? resolveExpr(body) : undefined,
      timeout: 15000,
      maxRedirects: 10,
      headers: customHeaders,
      validateStatus: status => status < 500, // allow 2xx, 3xx, 4xx
    });

    return {
      status: response.status,
      statusText: response.statusText,
      url: resolvedUrl,
      method,
      data: response.data,
      headers: response.headers,
    };
  },

  'action-log': async (node, ctx) => {
    // Can log previous output or custom message
    const message = node.data?.message || '';
    const prevData = ctx.lastOutput;

    let logContent;
    if (message.includes('{{prev}}') && prevData) {
      logContent = message.replace('{{prev}}', JSON.stringify(prevData, null, 2));
    } else if (!message && prevData) {
      logContent = JSON.stringify(prevData, null, 2);
    } else {
      logContent = message || 'Step executed';
    }

    console.log(`[LogicBridge] ${logContent}`);
    return { logged: true, message: logContent, timestamp: new Date().toISOString() };
  },

  'action-delay': async (node, ctx) => {
    const ms = (node.data?.seconds || 1) * 1000;
    await new Promise((res) => setTimeout(res, ms));
    return { delayed: ms, seconds: node.data?.seconds || 1, completedAt: new Date().toISOString() };
  },

  'action-transform': async (node, ctx) => {
    const prev = ctx.lastOutput;
    const template = node.data?.template || '';
    // Extract fields from previous output
    if (template && prev) {
      try {
        const tpl = JSON.parse(template);
        const result = {};
        for (const [key, val] of Object.entries(tpl)) {
          if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
            const path = val.slice(2, -2).replace('prev.', '').trim();
            result[key] = path.split('.').reduce((o, k) => o?.[k], prev) ?? val;
          } else {
            result[key] = val;
          }
        }
        return { transformed: result, source: 'previous_node' };
      } catch {
        return { transformed: template, source: 'raw' };
      }
    }
    return { transformed: prev || template, note: 'Pass-through of previous output' };
  },

  'logic-condition': async (node, ctx) => {
    let { leftValue = '', operator = 'equals', rightValue = '' } = node.data || {};
    const prev = ctx.lastOutput;

    // Allow {{prev.fieldName}} references
    if (prev && String(leftValue).startsWith('{{')) {
      const path = leftValue.replace('{{', '').replace('}}', '').replace('prev.', '').trim();
      leftValue = String(path.split('.').reduce((o, k) => o?.[k], prev) ?? leftValue);
    }

    let passed = false;
    switch (operator) {
      case 'equals':       passed = String(leftValue) === String(rightValue); break;
      case 'not-equals':   passed = String(leftValue) !== String(rightValue); break;
      case 'contains':     passed = String(leftValue).includes(String(rightValue)); break;
      case 'greater-than': passed = Number(leftValue) > Number(rightValue); break;
      case 'less-than':    passed = Number(leftValue) < Number(rightValue); break;
      default:             passed = Boolean(leftValue);
    }

    return { passed, leftValue, operator, rightValue, result: passed ? 'TRUE — continuing' : 'FALSE — condition not met' };
  },

  'action-csv': async (node, ctx) => {
    const prev = ctx.lastOutput;
    const delimiter = node.data?.delimiter || ',';
    const includeHeaders = node.data?.includeHeaders !== 'false';
    const customArrayPath = node.data?.arrayPath?.trim();

    // Helper: Recursively search for the primary Array in an object (e.g. records: [...])
    const findArray = (obj) => {
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
        const nested = findArray(obj.data);
        if (nested.length > 0) return nested;
      }
      for (const val of Object.values(obj)) {
        if (Array.isArray(val) && val.length > 0) return val;
      }
      return typeof obj === 'object' ? [obj] : [];
    };

    const rows = findArray(prev);

    if (!rows || rows.length === 0) {
      throw new Error('No dataset or records array found in previous step output');
    }

    // Determine columns definition
    let columnDefs = [];
    if (Array.isArray(node.data?.columns) && node.data.columns.length > 0) {
      columnDefs = node.data.columns;
    } else if (node.data?.fields) {
      columnDefs = node.data.fields.split(',').map(f => ({ header: f.trim(), value: `{{ ${f.trim()} }}` }));
    } else {
      const firstRow = rows[0] || {};
      columnDefs = Object.keys(firstRow).map(k => ({ header: k, value: `{{ ${k} }}` }));
    }

    // Value resolver for each row
    const getValueForRow = (expr, row) => {
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
    };

    const formatCsvCell = (val) => {
      const str = String(val ?? '');
      if (str.includes(delimiter) || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [];
    if (includeHeaders) {
      lines.push(columnDefs.map(c => formatCsvCell(c.header)).join(delimiter));
    }

    rows.forEach(row => {
      const line = columnDefs.map(c => {
        const cellValue = getValueForRow(c.value, row);
        return formatCsvCell(cellValue);
      }).join(delimiter);
      lines.push(line);
    });

    const csvContent = lines.join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${(node.data?.filename || 'attendance_report')}_${timestamp}.csv`;

    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csvContent, 'utf8');

    return {
      filename,
      filePath,
      rowCount: rows.length,
      columnsCount: columnDefs.length,
      headers: columnDefs.map(c => c.header),
      csvPreview: csvContent.slice(0, 800) + (csvContent.length > 800 ? '...' : ''),
      csvContent,
      generatedAt: new Date().toISOString(),
    };
  },
};


// ─── Topological Sort via edges ──────────────────────────────────────────────
function buildExecutionOrder(nodes, edges) {
  if (!edges || edges.length === 0) {
    // Fallback: sort by x position
    return [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
  }

  const inDegree = {};
  const adjacency = {};
  nodes.forEach((n) => { inDegree[n.id] = 0; adjacency[n.id] = []; });
  edges.forEach((e) => {
    adjacency[e.source] = adjacency[e.source] || [];
    adjacency[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    (adjacency[node.id] || []).forEach((targetId) => {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        const targetNode = nodes.find((n) => n.id === targetId);
        if (targetNode) queue.push(targetNode);
      }
    });
  }

  return order.length === nodes.length ? order : [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
}

// ─── Main run function ───────────────────────────────────────────────────────
async function run(workflow, ownerId, trigger = 'manual') {
  const startedAt = Date.now();
  const steps = [];
  let executionStatus = 'success';
  let executionError = null;

  const orderedNodes = buildExecutionOrder(workflow.nodes, workflow.edges);
  const context = { results: {}, lastOutput: null };

  for (const node of orderedNodes) {
    const stepStart = Date.now();
    const handler = handlers[node.type];

    if (!handler) {
      console.warn(`No handler for node type: ${node.type}`);
      continue;
    }

    const step = {
      nodeId: node.id,
      nodeName: node.data?.label || node.type,
      nodeType: node.type,
      status: 'success',
      input: { ...node.data, _previousOutput: context.lastOutput },
      output: null,
      error: null,
      duration: 0,
    };

    try {
      const output = await handler(node, context);
      step.output = output;
      context.results[node.id] = output;
      context.lastOutput = output; // pass to next node
    } catch (err) {
      step.status = 'failed';
      step.error = err.message;
      executionStatus = 'failed';
      executionError = `Node "${step.nodeName}" failed: ${err.message}`;
      step.duration = Date.now() - stepStart;
      steps.push(step);
      break;
    }

    step.duration = Date.now() - stepStart;
    steps.push(step);
  }

  const finishedAt = Date.now();

  const execution = await Execution.create({
    workflow: workflow._id,
    owner: ownerId,
    status: executionStatus,
    trigger,
    steps,
    startedAt: new Date(startedAt),
    finishedAt: new Date(finishedAt),
    duration: finishedAt - startedAt,
    error: executionError,
  });

  await Workflow.findByIdAndUpdate(workflow._id, {
    $inc: { runCount: 1 },
    lastRunAt: new Date(),
  });

  return execution;
}

module.exports = { run };
