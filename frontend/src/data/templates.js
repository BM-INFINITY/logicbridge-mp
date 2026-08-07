// Pre-built working workflow templates
export const TEMPLATES = [
  {
    id: 'student-attendance-csv',
    name: 'Student Attendance → CSV Report',
    description: 'Fetch student attendance from Google Apps Script API and export Name, Enrollment No, Team ID & Attendance as CSV',
    icon: '🎓',
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
    icon: '🌦️',
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
    icon: '🌐',
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
    icon: '🔄',
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
    icon: '🔀',
    nodes: [
      { id: 'n1', type: 'trigger-manual', position: { x: 80, y: 200 }, data: { label: 'Start' } },
      { id: 'n2', type: 'action-http', position: { x: 320, y: 200 }, data: { label: 'Get Post', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' } },
      { id: 'n3', type: 'logic-condition', position: { x: 560, y: 200 }, data: { label: 'Check ID', leftValue: '{{prev.id}}', operator: 'equals', rightValue: '1' } },
      { id: 'n4', type: 'action-log', position: { x: 800, y: 200 }, data: { label: 'Confirmed', message: 'Post ID matched condition!' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', animated: true },
      { id: 'e2', source: 'n2', target: 'n3', animated: true },
      { id: 'e3', source: 'n3', target: 'n4', animated: true },
    ],
  },
  {
    id: 'multi-api',
    name: 'Multi-Step Pipeline',
    description: 'Fetch data → delay → transform → log',
    icon: '⚡',
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
    label: 'Manual Trigger', icon: '⚡', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
    ],
  },
  'trigger-schedule': {
    label: 'Schedule Trigger', icon: '🕐', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'cron', type: 'text', label: 'Cron Expression' },
    ],
  },
  'trigger-webhook': {
    label: 'Webhook', icon: '🔗', color: '#22c55e', category: 'trigger',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
    ],
  },
  'action-http': {
    label: 'HTTP Request', icon: '🌐', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'url', type: 'text', label: 'URL' },
      { name: 'method', type: 'select', label: 'Method', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { name: 'queryParamsList', type: 'keyvalue', label: 'Query Parameters' },
      { name: 'headersList', type: 'keyvalue', label: 'Headers' },
      { name: 'body', type: 'code', label: 'Body (JSON)' },
    ],
  },
  'action-log': {
    label: 'Log Output', icon: '📋', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'message', type: 'text', label: 'Message' },
    ],
  },
  'action-delay': {
    label: 'Delay', icon: '⏱️', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'seconds', type: 'number', label: 'Wait Seconds' },
    ],
  },
  'action-transform': {
    label: 'Transform Data', icon: '🔄', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'template', type: 'code', label: 'JSON Template' },
    ],
  },
  'action-email': {
    label: 'Send Email', icon: '📧', color: '#6c63ff', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'to', type: 'text', label: 'Recipient Email' },
      { name: 'subject', type: 'text', label: 'Subject' },
      { name: 'body', type: 'code', label: 'Email Content' },
    ],
  },
  'action-csv': {
    label: 'Generate CSV', icon: '📊', color: '#10b981', category: 'action',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'columns', type: 'columns', label: 'CSV Columns' },
      { name: 'delimiter', type: 'select', label: 'Delimiter', options: [',', ';', '\t', '|'] },
      { name: 'includeHeaders', type: 'select', label: 'Include Headers', options: ['true', 'false'] },
      { name: 'filename', type: 'text', label: 'Filename' },
    ],
  },
  'logic-condition': {
    label: 'If / Condition', icon: '🔀', color: '#f59e0b', category: 'logic',
    configSchema: [
      { name: 'label', type: 'text', label: 'Label' },
      { name: 'leftValue', type: 'text', label: 'Left Field' },
      { name: 'operator', type: 'select', label: 'Operator', options: ['equals', 'not-equals', 'contains', 'greater-than', 'less-than'] },
      { name: 'rightValue', type: 'text', label: 'Right Value' },
    ],
  },
};
