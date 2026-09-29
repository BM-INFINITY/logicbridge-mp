// Pre-built working workflow templates
export const TEMPLATES = [
  {
    id: 'student-attendance-csv',
    name: 'Student Attendance → CSV Report',
    description: 'Fetch student attendance from Google Apps Script API and export Name, Enrollment No, Team ID & Attendance as CSV',
    icon: 'GraduationCap',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Manual Start' } },
      {
        id: 'n2', type: 'action-http', position: { x: 320, y: 200 },
        data: {
          label: 'Fetch Student Attendance',
          url: 'https://script.google.com/macros/s/AKfycbwP3XOlI33GcQzZ1m7DWzt-CuwRy3YB8BBwGU_0lFf7KD56kUY/exec?spreadsheet=a&action=get&id=1BQTxwQurI-0uSFmtILwcpHYCGO7PlXgYq7HSHWVhFss&sheet=Attendance&sheetuser=23012011002&sheetuserIndex=1',
          method: 'GET',
          queryParamsList: [
            { key: 'sheetuser', value: '23012011002' }
          ]
        }
      },
      {
        id: 'n3', type: 'action-csv', position: { x: 580, y: 200 },
        data: {
          label: 'Export Student CSV',
          filename: 'student_attendance_23012011002',
          arrayPath: 'records',
          columns: [
            { header: 'Enrollment No', value: '{{ Enrollment No. }}' },
            { header: 'Student Name', value: '{{ Name of Student }}' },
            { header: 'Branch', value: '{{ Branch }}' },
            { header: 'Team ID', value: '{{ Team Id }}' },
            { header: 'Attendance Rate', value: '{{ Attendance (%) }}' },
          ]
        }
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },
  {
    id: 'imd-weather-csv',
    name: 'IMD Weather → CSV (Daily 8AM)',
    description: 'Fetch all India weather from IMD API every 8 AM and save Station + Temperature as CSV',
    icon: 'CloudRain',
    nodes: [
      { id: 'n1', type: 'trigger-schedule', position: { x: 80, y: 200 }, data: { label: 'Every 8 AM', cron: '0 8 * * *' } },
      { id: 'n2', type: 'action-http', position: { x: 320, y: 200 }, data: { label: 'Fetch IMD Weather', url: 'https://api.imd.gov.in/api/v1/current_wx', method: 'GET' } },
      { id: 'n3', type: 'action-csv', position: { x: 580, y: 200 }, data: { label: 'Generate CSV', filename: 'imd_weather', columns: [{ header: 'Station Name', value: '{{ n2.Station }}' }, { header: 'Temperature (°C)', value: '{{ n2.Temperature }}' }] } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },
  {
    id: 'fetch-api',
    name: 'Fetch API Data',
    description: 'Fetch public JSON data and log the result',
    icon: 'Globe',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 320, y: 200 }, data: { label: 'Fetch Todo', url: 'https://jsonplaceholder.typicode.com/todos/1', method: 'GET' } },
      { id: 'n3', type: 'action-log', position: { x: 560, y: 200 }, data: { label: 'Log Result', message: 'API Response received' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
    ],
  },
  {
    id: 'weather-check',
    name: 'Fetch & Transform',
    description: 'Fetch user data, transform fields, log output',
    icon: 'Shuffle',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 320, y: 200 }, data: { label: 'Fetch User', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET' } },
      { id: 'n3', type: 'action-transform', position: { x: 560, y: 200 }, data: { label: 'Extract Fields', template: '{"name":"{{prev.name}}","email":"{{prev.email}}","city":"{{prev.address.city}}"}' } },
      { id: 'n4', type: 'action-log', position: { x: 800, y: 200 }, data: { label: 'Log User', message: 'User data transformed' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
    ],
  },
  {
    id: 'condition-flow',
    name: 'Conditional Flow',
    description: 'Fetch post, check condition, branch output',
    icon: 'GitBranch',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 300, y: 200 }, data: { label: 'Get Post', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' } },
      { id: 'n3', type: 'logic-condition', position: { x: 540, y: 200 }, data: { label: 'Check ID', leftValue: '{{prev.id}}', operator: 'equals', rightValue: '1' } },
      { id: 'n4', type: 'action-log', position: { x: 800, y: 140 }, data: { label: 'True Branch Log', message: 'Post ID matched condition!' } },
      { id: 'n5', type: 'action-log', position: { x: 800, y: 260 }, data: { label: 'False Branch Log', message: 'Condition failed!' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true', animated: true, label: 'True', style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fill: '#22c55e', fontWeight: 700 } },
      { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', animated: true, label: 'False', style: { stroke: '#ef4444', strokeWidth: 2 }, labelStyle: { fill: '#ef4444', fontWeight: 700 } },
    ],
  },
  {
    id: 'multi-api',
    name: 'Multi-Step Pipeline',
    description: 'Fetch data → delay → transform → log',
    icon: 'Zap',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 300, y: 200 }, data: { label: 'Fetch Posts', url: 'https://jsonplaceholder.typicode.com/posts/5', method: 'GET' } },
      { id: 'n3', type: 'action-delay', position: { x: 520, y: 200 }, data: { label: 'Wait 1s', seconds: 1 } },
      { id: 'n4', type: 'action-transform', position: { x: 740, y: 200 }, data: { label: 'Extract', template: '{"title":"{{prev.title}}","body":"{{prev.body}}"}' } },
      { id: 'n5', type: 'action-log', position: { x: 960, y: 200 }, data: { label: 'Final Log', message: 'Pipeline complete' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
      { id: 'e4', source: 'n4', target: 'n5', animated: true },
    ],
  },
];

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
