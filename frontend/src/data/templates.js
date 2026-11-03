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
    requiresConnection: null,
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
    requiresConnection: null,
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
          fields: ['name', 'email', 'phone'],
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
    requiresConnection: null,
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
    requiresConnection: 'postgres',
    tags: ['webhook', 'postgres', 'insert', 'database'],
    nodes: [
      { id: 'n1', type: 'trigger-webhook',  position: { x: 80,  y: 200 }, data: { label: 'Webhook Trigger' } },
      {
        id: 'n2', type: 'action-transform', position: { x: 320, y: 200 },
        data: {
          label: 'Prepare Record',
          operation: 'pick',
          fields: ['name', 'email', 'created_at'],
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
    requiresConnection: 'postgres',
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
          mappings: [{ outputField: 'users', source: '{{prev.rows}}' }],
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
    requiresConnection: 'mongodb',
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
    requiresConnection: 'google_sheets',
    tags: ['webhook', 'google-sheets', 'append', 'automation'],
    nodes: [
      { id: 'n1', type: 'trigger-webhook',  position: { x: 80,  y: 200 }, data: { label: 'Webhook Trigger' } },
      {
        id: 'n2', type: 'action-transform', position: { x: 320, y: 200 },
        data: { label: 'Prepare Row Data', operation: 'pick', fields: ['name', 'email', 'timestamp'] },
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
    requiresConnection: 'google_sheets',
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
        data: { label: 'Format Payload', operation: 'array-map', mappings: [{ outputField: 'records', source: '{{prev.rows}}' }] },
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
    requiresConnection: null,
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
        data: { label: 'Pick Fields', operation: 'pick', source: '{{n2.data}}', fields: ['userId', 'title'] },
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
    requiresConnection: null,
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
            { outputField: 'formattedTitle', source: '{{n4.result}}' },
            { outputField: 'timestamp', source: '{{n6.result}}' },
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
    requiresConnection: null,
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
    requiresConnection: null,
    tags: ['delay', 'transform', 'pipeline', 'starter'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 80,  y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http',     position: { x: 300, y: 200 }, data: { label: 'Fetch Post', url: 'https://jsonplaceholder.typicode.com/posts/5', method: 'GET' } },
      { id: 'n3', type: 'action-delay',    position: { x: 520, y: 200 }, data: { label: 'Wait 1s', seconds: 1 } },
      { id: 'n4', type: 'action-transform',position: { x: 740, y: 200 }, data: { label: 'Extract Fields', operation: 'pick', source: '{{n2.data}}', fields: ['title', 'body'] } },
      { id: 'n5', type: 'action-log',      position: { x: 960, y: 200 }, data: { label: 'Final Log', message: 'Pipeline complete: {{prev.title}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
    ],
  },

  // ── 13. Scheduled API Health Check & Email Alert ───────────────────────────
  {
    id: 'scheduled-health-email',
    name: 'Scheduled Health Check & Alert',
    description: 'Ping an API endpoint every 15 minutes, evaluate status code, and log operational health. The fallback alert branch triggers an email notification (requires an Email connection or SMTP settings; the normal healthy path runs with zero credentials).',
    category: 'automation',
    icon: 'Mail',
    nodeTypes: ['trigger-schedule', 'action-http', 'logic-condition', 'action-log', 'action-email'],
    difficulty: 'Intermediate',
    requiresConnection: 'email',
    tags: ['schedule', 'http', 'condition', 'email', 'alert', 'monitoring'],
    nodes: [
      { id: 'n1', type: 'trigger-schedule', position: { x: 60,  y: 220 }, data: { label: 'Every 15 Min', cron: '*/15 * * * *' } },
      { id: 'n2', type: 'action-http',     position: { x: 280, y: 220 }, data: { label: 'Health Probe', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' } },
      { id: 'n3', type: 'logic-condition', position: { x: 500, y: 220 }, data: { label: 'Status == 200?', leftValue: '{{prev.status}}', operator: 'equals', rightValue: '200' } },
      { id: 'n4', type: 'action-log',      position: { x: 740, y: 140 }, data: { label: 'Log Healthy', message: 'System operational: endpoint returned HTTP 200' } },
      {
        id: 'n5', type: 'action-email',    position: { x: 740, y: 300 },
        data: {
          label: 'Send Alert (Email/SMTP)',
          to: 'ops@example.com',
          subject: 'ALERT: API Health Check Failed',
          body: 'Endpoint health check returned unexpected status code. Please investigate immediately.\n\n[Note: This step requires an active Email connection (Gmail/SMTP) or configured SMTP server].',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },

  // ── 14. Text & Date Normalization Pipeline ─────────────────────────────────
  {
    id: 'text-date-normalization',
    name: 'Text & Date Normalization',
    description: 'Fetch user profile, uppercase company name, format current timestamp, and assemble cleaned payload with zero external credentials.',
    category: 'data-processing',
    icon: 'Type',
    nodeTypes: ['trigger-manual', 'action-http', 'action-text', 'action-date', 'action-transform', 'action-log'],
    difficulty: 'Beginner',
    requiresConnection: null,
    tags: ['text', 'date', 'utilities', 'transform', 'string', 'pipeline'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',   position: { x: 60,  y: 200 }, data: { label: 'Start Pipeline' } },
      { id: 'n2', type: 'action-http',      position: { x: 260, y: 200 }, data: { label: 'Fetch User Profile', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' } },
      { id: 'n3', type: 'action-text',      position: { x: 480, y: 200 }, data: { label: 'Uppercase Company', operation: 'uppercase', input: '{{prev.company.name}}' } },
      { id: 'n4', type: 'action-date',      position: { x: 700, y: 200 }, data: { label: 'Timestamp ISO', operation: 'now', dateFormat: 'YYYY-MM-DD HH:mm:ss' } },
      { id: 'n5', type: 'action-transform', position: { x: 920, y: 200 }, data: { label: 'Format Payload', operation: 'set', mappings: [{ outputField: 'customer', source: '{{n2.data.name}}' }] } },
      { id: 'n6', type: 'action-log',       position: { x: 1140, y: 200 }, data: { label: 'Log Normalized', message: 'Processed record at {{steps.n4.data}} for company {{steps.n3.data}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
      { id: 'e5', source: 'n5', target: 'n6', animated: true },
    ],
  },

  // ── 15. Developer Multi-Branch Logic & Routing Suite ───────────────────────
  {
    id: 'dev-multi-path-branching',
    name: 'Multi-Path Branching Suite',
    description: 'Developer test suite exercising multi-level branching, nested truthy/falsy evaluation, and alternative workflow execution paths.',
    category: 'developer',
    icon: 'GitBranch',
    nodeTypes: ['trigger-manual', 'action-http', 'logic-condition', 'action-math', 'action-log'],
    difficulty: 'Advanced',
    requiresConnection: null,
    tags: ['dev', 'test', 'branching', 'nested-logic', 'execution-paths', 'routing'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',  position: { x: 60,  y: 250 }, data: { label: '[DEV] Branch Trigger' } },
      { id: 'n2', type: 'action-http',     position: { x: 260, y: 250 }, data: { label: '[DEV] Query Post', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' } },
      { id: 'n3', type: 'logic-condition', position: { x: 480, y: 250 }, data: { label: '[DEV] Check ID == 1', leftValue: '{{prev.id}}', operator: 'equals', rightValue: '1' } },
      { id: 'n4', type: 'action-math',     position: { x: 720, y: 160 }, data: { label: '[DEV] Multiply Score', operation: 'multiply', valueA: '{{n2.id}}', valueB: '50' } },
      { id: 'n5', type: 'logic-condition', position: { x: 940, y: 160 }, data: { label: '[DEV] Check Score >= 50', leftValue: '{{prev.data}}', operator: 'greater-than', rightValue: '49' } },
      { id: 'n6', type: 'action-log',      position: { x: 1180, y: 100 }, data: { label: '[DEV] Branch A1 (Pass)', message: 'Score condition met: {{prev.data}}' } },
      { id: 'n7', type: 'action-log',      position: { x: 1180, y: 220 }, data: { label: '[DEV] Branch A2 (Low)', message: 'Score below threshold' } },
      { id: 'n8', type: 'action-log',      position: { x: 720, y: 340 }, data: { label: '[DEV] Branch B (Fallback)', message: 'Top-level condition failed for post id {{n2.id}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e4', source: 'n3', target: 'n8', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
      { id: 'e5', source: 'n4', target: 'n5', animated: true },
      { id: 'e6', source: 'n5', target: 'n6', sourceHandle: 'true',  animated: true, label: 'True',  style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e7', source: 'n5', target: 'n7', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },

  // ── 16. Developer Utility Nodes Stress Test ────────────────────────────────
  {
    id: 'dev-utility-suite',
    name: 'Utility Nodes Test Suite',
    description: 'Developer test suite validating JSON parsing, string manipulations, arithmetic calculations, and date formatting in sequence.',
    category: 'developer',
    icon: 'Code2',
    nodeTypes: ['trigger-manual', 'action-json', 'action-text', 'action-math', 'action-date', 'action-transform', 'action-log'],
    difficulty: 'Advanced',
    requiresConnection: null,
    tags: ['dev', 'test', 'json', 'text', 'math', 'date', 'utilities'],
    nodes: [
      { id: 'n1', type: 'trigger-manual',   position: { x: 60,  y: 220 }, data: { label: '[DEV] Utility Start' } },
      { id: 'n2', type: 'action-json',      position: { x: 260, y: 220 }, data: { label: '[DEV] Parse JSON', operation: 'parse', input: '{"product":"LogicBridge Cloud","price":49.99,"taxRate":0.15,"quantity":3}' } },
      { id: 'n3', type: 'action-text',      position: { x: 480, y: 220 }, data: { label: '[DEV] Uppercase Text', operation: 'uppercase', input: '{{prev.product}}' } },
      { id: 'n4', type: 'action-math',      position: { x: 700, y: 220 }, data: { label: '[DEV] Subtotal Math', operation: 'multiply', valueA: '{{steps.n2.data.price}}', valueB: '{{steps.n2.data.quantity}}' } },
      { id: 'n5', type: 'action-date',      position: { x: 920, y: 220 }, data: { label: '[DEV] Current Date', operation: 'now', dateFormat: 'YYYY-MM-DD' } },
      { id: 'n6', type: 'action-transform', position: { x: 1140, y: 220 }, data: { label: '[DEV] Final Map', operation: 'set', mappings: [{ outputField: 'item', source: '{{n2.data.product}}' }] } },
      { id: 'n7', type: 'action-log',       position: { x: 1360, y: 220 }, data: { label: '[DEV] Verify All', message: 'Verified Product: {{steps.n3.data}} | Total: {{steps.n4.data}} | Date: {{steps.n5.data}}' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
      { id: 'e5', source: 'n5', target: 'n6', animated: true },
      { id: 'e6', source: 'n6', target: 'n7', animated: true },
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
  'action-slack': {
    label: 'Slack', icon: 'MessageSquare', color: '#e01e5a', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'connectionId', type: 'select', label: 'Connection' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['send_message', 'send_dm', 'send_blocks', 'get_channel'] },
      { name: 'channel', type: 'text', label: 'Channel Name / ID' },
      { name: 'text', type: 'code', label: 'Message Text' },
      { name: 'userId', type: 'text', label: 'User ID (for DMs)' },
      { name: 'blocks', type: 'code', label: 'Blocks (JSON)' },
      { name: 'threadTs', type: 'text', label: 'Thread Timestamp' },
    ],
  },
  'action-discord': {
    label: 'Discord', icon: 'MessageCircle', color: '#5865f2', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'connectionId', type: 'select', label: 'Connection' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['send_message', 'send_embed', 'send_webhook', 'get_channel'] },
      { name: 'channelId', type: 'text', label: 'Channel ID' },
      { name: 'content', type: 'code', label: 'Message Content' },
      { name: 'webhookUrl', type: 'text', label: 'Webhook URL (optional override)' },
      { name: 'title', type: 'text', label: 'Embed Title' },
      { name: 'description', type: 'code', label: 'Embed Description' },
      { name: 'color', type: 'text', label: 'Embed Color' },
      { name: 'username', type: 'text', label: 'Webhook Username' },
      { name: 'avatarUrl', type: 'text', label: 'Avatar URL' },
    ],
  },
  'action-file': {
    label: 'File Operations', icon: 'HardDrive', color: '#10b981', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['read_file', 'write_file', 'create_file', 'delete_file', 'get_metadata', 'move_file'] },
      { name: 'path', type: 'text', label: 'File Path' },
      { name: 'format', type: 'select', label: 'Format', options: ['text', 'json', 'csv', 'binary'] },
      { name: 'content', type: 'code', label: 'Content' },
      { name: 'destinationPath', type: 'text', label: 'Destination Path (for Move)' },
    ],
  },
  'action-storage': {
    label: 'Storage', icon: 'Cloud', color: '#ff9900', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['local', 'aws_s3'] },
      { name: 'connectionId', type: 'select', label: 'Connection (S3)' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['upload', 'download', 'list', 'delete', 'get_metadata'] },
      { name: 'key', type: 'text', label: 'Key / Path' },
      { name: 'bucket', type: 'text', label: 'S3 Bucket' },
      { name: 'content', type: 'code', label: 'File Content / Reference' },
    ],
  },
  'action-loop': {
    label: 'Loop', icon: 'Repeat', color: '#06b6d4', category: 'logic',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'operation', type: 'select', label: 'Operation', options: ['loop_items', 'loop_batch', 'loop_range'] },
      { name: 'items', type: 'code', label: 'Items / Collection' },
      { name: 'batchSize', type: 'number', label: 'Batch Size' },
      { name: 'onError', type: 'select', label: 'Error Behavior', options: ['stop', 'continue'] },
      { name: 'maxIterations', type: 'number', label: 'Max Iterations' },
    ],
  },
  'logic-condition': {
    label: 'Condition', icon: 'GitBranch', color: '#f59e0b', category: 'logic',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'leftValue', type: 'text', label: 'Left Field' },
      { name: 'operator', type: 'select', label: 'Operator', options: ['equals', 'not-equals', 'contains', 'greater-than', 'less-than'] },
      { name: 'rightValue', type: 'text', label: 'Right Value' },
    ],
  },
  'action-switch': {
    label: 'Switch / Router', icon: 'GitFork', color: '#8b5cf6', category: 'logic',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'input', type: 'text', label: 'Input Expression' },
      { name: 'mode', type: 'select', label: 'Mode', options: ['value', 'rule'] },
    ],
  },
  'action-approval': {
    label: 'Human Approval', icon: 'UserCheck', color: '#ec4899', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'title', type: 'text', label: 'Approval Title' },
      { name: 'description', type: 'text', label: 'Description' },
      { name: 'message', type: 'text', label: 'Approval Message' },
      { name: 'allowedApprovers', type: 'text', label: 'Allowed Approvers' },
      { name: 'approverRole', type: 'text', label: 'Approver Role' },
      { name: 'timeoutMinutes', type: 'number', label: 'Timeout (Minutes)' },
      { name: 'timeoutAction', type: 'select', label: 'Timeout Action', options: ['reject', 'approve'] },
    ],
  },
  'action-wait': {
    label: 'Wait / Delay', icon: 'Clock', color: '#0ea5e9', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'waitType', type: 'select', label: 'Wait Type', options: ['duration', 'date', 'event'] },
      { name: 'durationSeconds', type: 'number', label: 'Duration (Seconds)' },
      { name: 'waitUntil', type: 'text', label: 'Target Date / Time' },
      { name: 'eventName', type: 'text', label: 'Event Name' },
      { name: 'timeoutMinutes', type: 'number', label: 'Timeout (Minutes)' },
    ],
  },
  'action-ai-generate': {
    label: 'AI Generate', icon: 'Sparkles', color: '#8b5cf6', category: 'ai',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['openai', 'openrouter', 'anthropic', 'ollama'] },
      { name: 'model', type: 'text', label: 'Model' },
      { name: 'prompt', type: 'code', label: 'Prompt' },
      { name: 'systemPrompt', type: 'text', label: 'System Prompt' },
      { name: 'temperature', type: 'number', label: 'Temperature' },
      { name: 'maxTokens', type: 'number', label: 'Max Tokens' },
    ],
  },
  'action-ai-chat': {
    label: 'AI Chat', icon: 'MessageSquare', color: '#8b5cf6', category: 'ai',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['openai', 'openrouter', 'anthropic', 'ollama'] },
      { name: 'model', type: 'text', label: 'Model' },
      { name: 'systemPrompt', type: 'text', label: 'System Prompt' },
      { name: 'temperature', type: 'number', label: 'Temperature' },
      { name: 'maxTokens', type: 'number', label: 'Max Tokens' },
    ],
  },
  'action-ai-structured': {
    label: 'AI Structured Output', icon: 'Braces', color: '#8b5cf6', category: 'ai',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['openai', 'openrouter', 'anthropic', 'ollama'] },
      { name: 'model', type: 'text', label: 'Model' },
      { name: 'prompt', type: 'code', label: 'Prompt' },
      { name: 'schema', type: 'code', label: 'JSON Schema' },
      { name: 'schemaName', type: 'text', label: 'Schema Name' },
    ],
  },
  'action-ai-classify': {
    label: 'AI Classification', icon: 'Tag', color: '#8b5cf6', category: 'ai',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['openai', 'openrouter', 'anthropic', 'ollama'] },
      { name: 'model', type: 'text', label: 'Model' },
      { name: 'input', type: 'text', label: 'Input Text' },
      { name: 'categories', type: 'text', label: 'Categories' },
    ],
  },
  'action-ai-embeddings': {
    label: 'AI Embeddings', icon: 'Brain', color: '#8b5cf6', category: 'ai',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'provider', type: 'select', label: 'Provider', options: ['openai', 'openrouter', 'ollama'] },
      { name: 'model', type: 'text', label: 'Model' },
      { name: 'input', type: 'text', label: 'Input Text' },
      { name: 'dimensions', type: 'number', label: 'Dimensions' },
    ],
  },
};

// ── Backward-Compatibility Non-Enumerable Aliases ───────────────────────────
// These ensure legacy node types resolve in canvas and lookups without creating
// duplicate visual entries in Object.entries(NODE_DEFS) used by the NodePalette.
Object.defineProperty(NODE_DEFS, 'action-condition', {
  value: NODE_DEFS['logic-condition'],
  enumerable: false,
  configurable: true,
  writable: true,
});

Object.defineProperty(NODE_DEFS, 'logic-switch', {
  value: NODE_DEFS['action-switch'],
  enumerable: false,
  configurable: true,
  writable: true,
});

Object.defineProperty(NODE_DEFS, 'action-delay', {
  value: NODE_DEFS['action-wait'],
  enumerable: false,
  configurable: true,
  writable: true,
});
