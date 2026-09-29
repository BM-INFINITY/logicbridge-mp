/**
 * templates.js — Workflow template definitions and node palette config.
 *
 * TEMPLATES array: complete workflow templates with metadata for the Templates UI.
 * NODE_DEFS object: node type definitions used by the palette and builder.
 */

// ─── Template Categories ──────────────────────────────────────────────────────

export const TEMPLATE_CATEGORIES = [
  { id: 'all',             label: 'All Templates' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'api',             label: 'API' },
  { id: 'database',        label: 'Database' },
  { id: 'automation',      label: 'Automation' },
  { id: 'data-processing', label: 'Data Processing' },
  { id: 'developer',       label: 'Developer' },
];

// ─── Workflow Templates ───────────────────────────────────────────────────────

export const TEMPLATES = [
  // ── 1. HTTP API Request ───────────────────────────────────────────────────
  {
    id: 'http-api-request',
    name: 'HTTP API Request',
    description: 'Fetch data from a public API and log the result. The simplest complete workflow — great for getting started.',
    category: 'getting-started',
    icon: 'Globe',
    nodeTypes: ['trigger-manual', 'action-http', 'action-log'],
    difficulty: 'Beginner',
    tags: ['http', 'api', 'get', 'log', 'starter'],
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80,  y: 200 }, data: { label: 'Manual Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 320, y: 200 },
        data: {
          label: 'Fetch Todo',
          url: 'https://jsonplaceholder.typicode.com/todos/1',
          method: 'GET',
        },
      },
      { id: 'n3', type: 'action-log', position: { x: 560, y: 200 }, data: { label: 'Log Result', message: 'API Response: {{prev.title}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },

  // ── 2. API Data Transformation ────────────────────────────────────────────
  {
    id: 'api-transform',
    name: 'API Data Transformation',
    description: 'Fetch user data from an API, extract specific fields using Transform, and log the cleaned output.',
    category: 'api',
    icon: 'Shuffle',
    nodeTypes: ['trigger-manual', 'action-http', 'action-transform', 'action-log'],
    difficulty: 'Beginner',
    tags: ['http', 'transform', 'api', 'map'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 80,  y: 200 }, data: { label: 'Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 320, y: 200 },
        data: { label: 'Fetch User', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' },
      },
      {
        id: 'n3', type: 'action-transform', position: { x: 560, y: 200 },
        data: {
          label: 'Extract Fields',
          operation: 'pick',
          fields: 'name,email,phone',
        },
      },
      { id: 'n4', type: 'action-log', position: { x: 800, y: 200 }, data: { label: 'Log User', message: 'User: {{prev.name}} · {{prev.email}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
    ],
  },

  // ── 3. Conditional Flow ───────────────────────────────────────────────────
  {
    id: 'conditional-flow',
    name: 'Conditional Branching',
    description: 'Fetch a post, check a condition, and route to different branches based on the result.',
    category: 'getting-started',
    icon: 'GitBranch',
    nodeTypes: ['trigger-manual', 'action-http', 'logic-condition', 'action-log'],
    difficulty: 'Beginner',
    tags: ['condition', 'branch', 'if', 'logic'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 80,  y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http',     position: { x: 300, y: 200 }, data: { label: 'Get Post', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' } },
      { id: 'n3', type: 'logic-condition', position: { x: 540, y: 200 }, data: { label: 'Check ID', leftValue: '{{prev.id}}', operator: 'equals', rightValue: '1' } },
      { id: 'n4', type: 'action-log',      position: { x: 800, y: 120 }, data: { label: 'True Branch', message: 'Post ID matched condition!' } },
      { id: 'n5', type: 'action-log',      position: { x: 800, y: 280 }, data: { label: 'False Branch', message: 'Condition failed.' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },

  // ── 4. Webhook → Database ─────────────────────────────────────────────────
  {
    id: 'webhook-to-postgres',
    name: 'Webhook → Database',
    description: 'Receive an incoming webhook, transform the payload, and insert the record into PostgreSQL.',
    category: 'database',
    icon: 'Database',
    nodeTypes: ['trigger-webhook', 'action-transform', 'action-postgres'],
    difficulty: 'Intermediate',
    tags: ['webhook', 'postgres', 'insert', 'database'],
    nodes: [
      { id: 'n1', type: 'trigger-webhook',  position: { x: 80,  y: 200 }, data: { label: 'Webhook Trigger' } },
      {
        id: 'n2', type: 'action-transform', position: { x: 320, y: 200 },
        data: {
          label: 'Prepare Record',
          operation: 'pick',
          fields: 'name,email,created_at',
        },
      },
      {
        id: 'n3', type: 'action-postgres', position: { x: 560, y: 200 },
        data: {
          label: 'Insert Row',
          operation: 'insert',
          table: 'users',
          // connectionId must be set by the user
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },

  // ── 5. Database → API ─────────────────────────────────────────────────────
  {
    id: 'database-to-api',
    name: 'Database → API Sync',
    description: 'Run on a schedule, query rows from PostgreSQL, transform the data, and POST it to an external API.',
    category: 'database',
    icon: 'Database',
    nodeTypes: ['trigger-schedule', 'action-postgres', 'action-transform', 'action-http'],
    difficulty: 'Intermediate',
    tags: ['schedule', 'postgres', 'select', 'http', 'post', 'sync'],
    nodes: [
      { id: 'n1', type: 'trigger-schedule', position: { x: 80,  y: 200 }, data: { label: 'Every Day 9 AM', cron: '0 9 * * *' } },
      {
        id: 'n2', type: 'action-postgres', position: { x: 300, y: 200 },
        data: {
          label: 'Query Users',
          operation: 'select',
          table: 'users',
          limit: '100',
        },
      },
      {
        id: 'n3', type: 'action-transform', position: { x: 540, y: 200 },
        data: {
          label: 'Format Payload',
          operation: 'map',
          mappings: [{ from: 'rows', to: 'users' }],
        },
      },
      {
        id: 'n4', type: 'action-http', position: { x: 780, y: 200 },
        data: {
          label: 'POST to API',
          url: 'https://api.example.com/sync',
          method: 'POST',
          headersList: [{ key: 'Content-Type', value: 'application/json' }],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
    ],
  },

  // ── 6. MongoDB Data Processing ────────────────────────────────────────────
  {
    id: 'mongodb-processing',
    name: 'MongoDB Data Processing',
    description: 'Trigger manually, query MongoDB for documents, transform, check a condition, then notify via HTTP.',
    category: 'database',
    icon: 'Database',
    nodeTypes: ['trigger-manual', 'action-mongodb', 'action-transform', 'logic-condition', 'action-http'],
    difficulty: 'Intermediate',
    tags: ['mongodb', 'find', 'transform', 'condition', 'http'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 60,  y: 200 }, data: { label: 'Manual Start' } },
      {
        id: 'n2', type: 'action-mongodb', position: { x: 260, y: 200 },
        data: {
          label: 'Find Documents',
          operation: 'find',
          collection: 'events',
          filter: '{"status":"pending"}',
          limit: '50',
        },
      },
      {
        id: 'n3', type: 'action-transform', position: { x: 480, y: 200 },
        data: { label: 'Extract Count', operation: 'array-length' },
      },
      {
        id: 'n4', type: 'logic-condition', position: { x: 700, y: 200 },
        data: { label: 'Has Records?', leftValue: '{{prev.result}}', operator: 'greater-than', rightValue: '0' },
      },
      {
        id: 'n5', type: 'action-http', position: { x: 940, y: 120 },
        data: { label: 'Send Alert', url: 'https://api.example.com/alert', method: 'POST' },
      },
      { id: 'n6', type: 'action-log', position: { x: 940, y: 280 }, data: { label: 'Log Empty', message: 'No pending events.' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e5', source: 'n4', target: 'n6', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },

  // ── 7. Webhook → Google Sheets ────────────────────────────────────────────
  {
    id: 'webhook-to-sheets',
    name: 'Webhook → Google Sheets',
    description: 'Receive a webhook payload, transform it, and append a new row to a Google Sheet automatically.',
    category: 'automation',
    icon: 'Table',
    nodeTypes: ['trigger-webhook', 'action-transform', 'action-google-sheets'],
    difficulty: 'Intermediate',
    tags: ['webhook', 'google-sheets', 'append', 'automation'],
    nodes: [
      { id: 'n1', type: 'trigger-webhook',  position: { x: 80,  y: 200 }, data: { label: 'Webhook Trigger' } },
      {
        id: 'n2', type: 'action-transform', position: { x: 320, y: 200 },
        data: { label: 'Prepare Row Data', operation: 'pick', fields: 'name,email,timestamp' },
      },
      {
        id: 'n3', type: 'action-google-sheets', position: { x: 560, y: 200 },
        data: {
          label: 'Append Row',
          operation: 'add_row',
          spreadsheet: 'YOUR_SPREADSHEET_ID',
          sheet: 'Sheet1',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },

  // ── 8. Google Sheets → API ────────────────────────────────────────────────
  {
    id: 'sheets-to-api',
    name: 'Google Sheets → API Sync',
    description: 'Pull rows from a Google Sheet on a schedule, transform them, and POST each row to an external API.',
    category: 'automation',
    icon: 'Table',
    nodeTypes: ['trigger-schedule', 'action-google-sheets', 'action-transform', 'action-http'],
    difficulty: 'Intermediate',
    tags: ['schedule', 'google-sheets', 'get-rows', 'http', 'sync'],
    nodes: [
      { id: 'n1', type: 'trigger-schedule', position: { x: 80,  y: 200 }, data: { label: 'Every Hour', cron: '0 * * * *' } },
      {
        id: 'n2', type: 'action-google-sheets', position: { x: 300, y: 200 },
        data: {
          label: 'Get All Rows',
          operation: 'get_rows',
          spreadsheet: 'YOUR_SPREADSHEET_ID',
          sheet: 'Sheet1',
        },
      },
      {
        id: 'n3', type: 'action-transform', position: { x: 540, y: 200 },
        data: { label: 'Format Payload', operation: 'array-map', mappings: [{ from: 'rows', to: 'records' }] },
      },
      {
        id: 'n4', type: 'action-http', position: { x: 780, y: 200 },
        data: { label: 'POST to API', url: 'https://api.example.com/import', method: 'POST' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
    ],
  },

  // ── 9. Data Processing Pipeline ───────────────────────────────────────────
  {
    id: 'data-processing-pipeline',
    name: 'Data Processing Pipeline',
    description: 'Full data pipeline: fetch → parse JSON → transform fields → math calculation → conditional output.',
    category: 'data-processing',
    icon: 'Braces',
    nodeTypes: ['trigger-manual', 'action-http', 'action-json', 'action-transform', 'action-math', 'logic-condition'],
    difficulty: 'Advanced',
    tags: ['json', 'transform', 'math', 'condition', 'pipeline'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 60,  y: 200 }, data: { label: 'Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 240, y: 200 },
        data: { label: 'Fetch Data', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' },
      },
      {
        id: 'n3', type: 'action-json', position: { x: 420, y: 200 },
        data: { label: 'Get User ID', operation: 'get', path: 'userId' },
      },
      {
        id: 'n4', type: 'action-transform', position: { x: 600, y: 200 },
        data: { label: 'Pick Fields', operation: 'pick', fields: 'userId,title' },
      },
      {
        id: 'n5', type: 'action-math', position: { x: 780, y: 200 },
        data: { label: 'Multiply ID', operation: 'multiply', valueA: '{{prev.userId}}', valueB: '100' },
      },
      {
        id: 'n6', type: 'logic-condition', position: { x: 980, y: 200 },
        data: { label: 'Result > 50?', leftValue: '{{prev.result}}', operator: 'greater-than', rightValue: '50' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
      { id: 'e5', source: 'n5', target: 'n6', animated: true },
    ],
  },

  // ── 10. Developer Test Workflow ───────────────────────────────────────────
  {
    id: 'developer-test-workflow',
    name: 'Developer Test Workflow',
    description: 'Exercises HTTP, JSON, Transform, Math, Text, Date, Condition, and Delay. Use to verify node execution, replay, and serialization.',
    category: 'developer',
    icon: 'Code2',
    nodeTypes: ['trigger-manual', 'action-http', 'action-json', 'action-transform', 'action-math', 'action-text', 'action-date', 'action-delay', 'logic-condition', 'action-log'],
    difficulty: 'Advanced',
    tags: ['dev', 'test', 'all-nodes', 'debug', 'replay', 'serialization'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 60,  y: 300 }, data: { label: '[DEV] Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 240, y: 300 },
        data: { label: '[DEV] Fetch Post', url: 'https://jsonplaceholder.typicode.com/posts/42', method: 'GET' },
      },
      {
        id: 'n3', type: 'action-json', position: { x: 420, y: 200 },
        data: { label: '[DEV] Get Title', operation: 'get', path: 'title' },
      },
      {
        id: 'n4', type: 'action-text', position: { x: 600, y: 200 },
        data: { label: '[DEV] Uppercase', operation: 'uppercase', input: '{{prev.result}}' },
      },
      {
        id: 'n5', type: 'action-math', position: { x: 420, y: 400 },
        data: { label: '[DEV] Math', operation: 'add', valueA: '{{n2.userId}}', valueB: '1000' },
      },
      {
        id: 'n6', type: 'action-date', position: { x: 600, y: 400 },
        data: { label: '[DEV] Timestamp', operation: 'now', dateFormat: 'YYYY-MM-DD HH:mm:ss' },
      },
      {
        id: 'n7', type: 'action-transform', position: { x: 780, y: 300 },
        data: {
          label: '[DEV] Merge', operation: 'set',
          mappings: [
            { from: 'title', to: 'formattedTitle' },
            { from: 'result', to: 'timestamp' },
          ],
        },
      },
      {
        id: 'n8', type: 'action-delay', position: { x: 980, y: 300 },
        data: { label: '[DEV] 0.5s Delay', seconds: 0.5 },
      },
      {
        id: 'n9', type: 'logic-condition', position: { x: 1160, y: 300 },
        data: { label: '[DEV] Check', leftValue: '{{n2.id}}', operator: 'greater-than', rightValue: '40' },
      },
      { id: 'n10', type: 'action-log', position: { x: 1380, y: 220 }, data: { label: '[DEV] Pass', message: 'TEST PASS: id > 40' } },
      { id: 'n11', type: 'action-log', position: { x: 1380, y: 380 }, data: { label: '[DEV] Fail', message: 'TEST FAIL: id <= 40' } },
    ],
    edges: [
      { id: 'e1',  source: 'n1',  target: 'n2', animated: true },
      { id: 'e2',  source: 'n2',  target: 'n3', animated: true },
      { id: 'e3',  source: 'n3',  target: 'n4', animated: true },
      { id: 'e4',  source: 'n2',  target: 'n5', animated: true },
      { id: 'e5',  source: 'n5',  target: 'n6', animated: true },
      { id: 'e6',  source: 'n4',  target: 'n7', animated: true },
      { id: 'e7',  source: 'n6',  target: 'n7', animated: true },
      { id: 'e8',  source: 'n7',  target: 'n8', animated: true },
      { id: 'e9',  source: 'n8',  target: 'n9', animated: true },
      { id: 'e10', source: 'n9',  target: 'n10', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e11', source: 'n9',  target: 'n11', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },

  // ── Legacy templates (kept for backward compat) ───────────────────────────
  {
    id: 'student-attendance-csv',
    name: 'Student Attendance → CSV',
    description: 'Fetch student attendance from a Google Apps Script API and export as CSV.',
    category: 'data-processing',
    icon: 'FileText',
    nodeTypes: ['trigger-manual', 'action-http', 'action-csv'],
    difficulty: 'Intermediate',
    tags: ['csv', 'http', 'export', 'attendance'],
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Manual Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 320, y: 200 },
        data: {
          label: 'Fetch Student Attendance',
          url: 'https://script.google.com/macros/s/AKfycbwP3XOlI33GcQzZ1m7DWzt-CuwRy3YB8BBwGU_0lFf7KD56kUY/exec?spreadsheet=a&action=get&id=1BQTxwQurI-0uSFmtILwcpHYCGO7PlXgYq7HSHWVhFss&sheet=Attendance&sheetuser=23012011002&sheetuserIndex=1',
          method: 'GET',
        },
      },
      {
        id: 'n3', type: 'action-csv', position: { x: 580, y: 200 },
        data: {
          label: 'Export Student CSV',
          filename: 'student_attendance',
          arrayPath: 'records',
          columns: [
            { header: 'Enrollment No', value: '{{ Enrollment No. }}' },
            { header: 'Student Name',  value: '{{ Name of Student }}' },
            { header: 'Branch',        value: '{{ Branch }}' },
            { header: 'Team ID',       value: '{{ Team Id }}' },
            { header: 'Attendance %',  value: '{{ Attendance (%) }}' },
          ],
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },

  {
    id: 'multi-step-pipeline',
    name: 'Multi-Step Pipeline',
    description: 'Fetch data, wait 1 second, transform fields, and log the final result.',
    category: 'getting-started',
    icon: 'Zap',
    nodeTypes: ['trigger-manual', 'action-http', 'action-delay', 'action-transform', 'action-log'],
    difficulty: 'Beginner',
    tags: ['delay', 'transform', 'pipeline', 'starter'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 80,  y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http',     position: { x: 300, y: 200 }, data: { label: 'Fetch Post', url: 'https://jsonplaceholder.typicode.com/posts/5', method: 'GET' } },
      { id: 'n3', type: 'action-delay',    position: { x: 520, y: 200 }, data: { label: 'Wait 1s', seconds: 1 } },
      { id: 'n4', type: 'action-transform',position: { x: 740, y: 200 }, data: { label: 'Extract Fields', operation: 'pick', fields: 'title,body' } },
      { id: 'n5', type: 'action-log',      position: { x: 960, y: 200 }, data: { label: 'Final Log', message: 'Pipeline complete: {{prev.title}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
    ],
  },
];

// ─── Node Palette Definitions ─────────────────────────────────────────────────

export const NODE_DEFS = {
  'trigger-manual': {
    label: 'Manual Trigger', icon: 'Zap', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
    ],
  },
  'trigger-schedule': {
    label: 'Schedule Trigger', icon: 'Clock', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'cron', type: 'text', label: 'Cron Expression' },
    ],
  },
  'trigger-webhook': {
    label: 'Webhook', icon: 'Webhook', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
    ],
  },
  'action-http': {
    label: 'HTTP Request', icon: 'Globe', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'url', type: 'text', label: 'URL' },
      { name: 'method', type: 'select', label: 'Method', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
      { name: 'queryParamsList', type: 'keyvalue', label: 'Query Parameters' },
      { name: 'headersList', type: 'keyvalue', label: 'Headers' },
      { name: 'body', type: 'code', label: 'Body (JSON)' },
    ],
  },
  'action-log': {
    label: 'Log Output', icon: 'FileText', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'message', type: 'text', label: 'Message' },
    ],
  },
  'action-delay': {
    label: 'Delay', icon: 'Timer', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'seconds', type: 'number', label: 'Wait Seconds' },
    ],
  },
  'action-transform': {
    label: 'Transform Data', icon: 'Shuffle', color: '#8b5cf6', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['map', 'pick', 'omit', 'set', 'remove', 'array-map', 'array-filter', 'array-find', 'array-first', 'array-last', 'array-length'] },
      { name: 'source', type: 'text', label: 'Input Source (optional)' },
      { name: 'mappings', type: 'mappings', label: 'Field Mappings' },
      { name: 'fields', type: 'fields', label: 'Field Names' },
    ],
  },
  'action-email': {
    label: 'Send Email', icon: 'Mail', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'to', type: 'text', label: 'Recipient Email' },
      { name: 'subject', type: 'text', label: 'Subject' },
      { name: 'body', type: 'code', label: 'Email Content' },
    ],
  },
  'action-csv': {
    label: 'Generate CSV', icon: 'Table', color: '#10b981', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'columns', type: 'columns', label: 'CSV Columns' },
      { name: 'delimiter', type: 'select', label: 'Delimiter', options: [',', ';', '\t', '|'] },
      { name: 'includeHeaders', type: 'select', label: 'Include Headers', options: ['true', 'false'] },
      { name: 'filename', type: 'text', label: 'Filename' },
    ],
  },
  'action-json': {
    label: 'JSON', icon: 'Braces', color: '#f59e0b', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['parse', 'stringify', 'get', 'set', 'remove'] },
      { name: 'input', type: 'text', label: 'Input' },
      { name: 'path', type: 'text', label: 'Property Path' },
      { name: 'value', type: 'text', label: 'Value' },
      { name: 'pretty', type: 'select', label: 'Pretty Print', options: ['false', 'true'] },
    ],
  },
  'action-text': {
    label: 'Text', icon: 'Type', color: '#06b6d4', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['uppercase', 'lowercase', 'trim', 'replace', 'contains', 'startsWith', 'endsWith', 'split', 'join', 'length', 'substring'] },
      { name: 'input', type: 'text', label: 'Input' },
    ],
  },
  'action-math': {
    label: 'Math', icon: 'Calculator', color: '#8b5cf6', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['add', 'subtract', 'multiply', 'divide', 'modulo', 'round', 'floor', 'ceil', 'absolute', 'min', 'max', 'percentage'] },
      { name: 'valueA', type: 'text', label: 'Value A' },
      { name: 'valueB', type: 'text', label: 'Value B' },
    ],
  },
  'action-date': {
    label: 'Date & Time', icon: 'Calendar', color: '#ec4899', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['now', 'parse', 'format', 'add', 'subtract', 'compare', 'difference'] },
      { name: 'dateInput', type: 'text', label: 'Date Input' },
      { name: 'dateFormat', type: 'text', label: 'Format' },
      { name: 'amount', type: 'text', label: 'Amount' },
      { name: 'unit', type: 'select', label: 'Unit', options: ['milliseconds', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'] },
    ],
  },
  'action-postgres': {
    label: 'PostgreSQL', icon: 'Database', color: '#336791', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'connectionId', type: 'select', label: 'Connection' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['select', 'insert', 'update', 'delete', 'query'] },
      { name: 'table', type: 'text', label: 'Table' },
      { name: 'columns', type: 'text', label: 'Columns' },
      { name: 'filters', type: 'text', label: 'Filters' },
      { name: 'values', type: 'text', label: 'Values' },
      { name: 'limit', type: 'text', label: 'Limit' },
      { name: 'query', type: 'code', label: 'Raw SQL' },
    ],
  },
  'action-mongodb': {
    label: 'MongoDB', icon: 'Database', color: '#13aa52', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'connectionId', type: 'select', label: 'Connection' },
      { name: 'database', type: 'text', label: 'Database' },
      { name: 'collection', type: 'text', label: 'Collection' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'deleteOne', 'count'] },
      { name: 'filter', type: 'code', label: 'Filter (JSON)' },
      { name: 'document', type: 'code', label: 'Document / Update (JSON)' },
      { name: 'limit', type: 'text', label: 'Limit' },
    ],
  },
  'action-google-sheets': {
    label: 'Google Sheets', icon: 'Table', color: '#0f9d58', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'connectionId', type: 'select', label: 'Connection' },
      { name: 'spreadsheet', type: 'text', label: 'Spreadsheet ID or URL' },
      { name: 'sheet', type: 'text', label: 'Sheet Name' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['get_rows', 'get_row', 'add_row', 'update_row', 'delete_row', 'find_row'] },
      { name: 'rowNumber', type: 'text', label: 'Row Number' },
      { name: 'row', type: 'text', label: 'Row Data / Values' },
      { name: 'searchColumn', type: 'text', label: 'Search Column' },
      { name: 'searchValue', type: 'text', label: 'Search Value' },
    ],
  },
  'logic-condition': {
    label: 'If / Condition', icon: 'GitBranch', color: '#f59e0b', category: 'logic',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'leftValue', type: 'text', label: 'Left Field' },
      { name: 'operator', type: 'select', label: 'Operator', options: ['equals', 'not-equals', 'contains', 'greater-than', 'less-than'] },
      { name: 'rightValue', type: 'text', label: 'Right Value' },
    ],
  },
};
