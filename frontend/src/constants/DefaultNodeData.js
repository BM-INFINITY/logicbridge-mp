import { NodeTypes } from './NodeTypes.js';

export const DefaultNodeData = Object.freeze({
  [NodeTypes.TRIGGER_MANUAL]: { label: 'Manual Start' },
  [NodeTypes.TRIGGER_SCHEDULE]: { label: 'Schedule Trigger', cron: '0 8 * * *' },
  [NodeTypes.TRIGGER_WEBHOOK]: { label: 'Webhook Listener' },
  [NodeTypes.ACTION_HTTP]: { label: 'HTTP Request', method: 'GET', url: '' },
  [NodeTypes.ACTION_LOG]: { label: 'Log Output', message: '' },
  [NodeTypes.ACTION_DELAY]: { label: 'Delay', seconds: 1 },
  [NodeTypes.ACTION_TRANSFORM]: { label: 'Transform Data', operation: 'map', mappings: [], fields: [], source: '' },
  [NodeTypes.ACTION_CSV]: { label: 'Generate CSV', filename: 'report', delimiter: ',' },
  [NodeTypes.ACTION_JSON]: { label: 'JSON', operation: 'parse', input: '', path: '', value: '', pretty: false },
  [NodeTypes.ACTION_TEXT]: { label: 'Text', operation: 'uppercase', input: '', find: '', replace: '', search: '', separator: ',', start: '0', end: '' },
  [NodeTypes.ACTION_MATH]: { label: 'Math', operation: 'add', valueA: '', valueB: '' },
  [NodeTypes.ACTION_DATE]: { label: 'Date & Time', operation: 'now', dateInput: '', dateFormat: 'YYYY-MM-DD', amount: '1', unit: 'days', dateA: '', dateB: '', outputUnit: 'days' },
  [NodeTypes.ACTION_POSTGRES]: { label: 'PostgreSQL', connectionId: '', operation: 'select', table: '', columns: '*', filters: '', values: '', limit: '10', query: '' },
  [NodeTypes.ACTION_MONGODB]: { label: 'MongoDB', connectionId: '', database: '', collection: '', operation: 'find', filter: '', document: '', update: '', limit: '50' },
  [NodeTypes.ACTION_GOOGLE_SHEETS]: { label: 'Google Sheets', connectionId: '', spreadsheet: '', sheet: 'Sheet1', operation: 'get_rows', rowNumber: '', row: '', searchColumn: '', searchValue: '' },
  [NodeTypes.ACTION_SLACK]: { label: 'Slack', connectionId: '', operation: 'send_message', channel: '', text: '', userId: '', blocks: '', threadTs: '' },
  [NodeTypes.ACTION_DISCORD]: { label: 'Discord', connectionId: '', operation: 'send_message', channelId: '', content: '', webhookUrl: '', title: '', description: '', color: '#6c63ff', username: '', avatarUrl: '' },
  [NodeTypes.ACTION_FILE]: { label: 'File Operations', operation: 'read_file', path: '', format: 'text', encoding: 'utf8', content: '', overwrite: true, append: false, destinationPath: '', ignoreMissing: false },
  [NodeTypes.ACTION_STORAGE]: { label: 'Storage Operations', provider: 'local', connectionId: '', operation: 'upload', key: '', bucket: '', region: 'us-east-1', content: '', format: 'text', prefix: '', limit: '100' },
  [NodeTypes.ACTION_LOOP]: { label: 'Loop / Batch', operation: 'loop_items', items: '', batchSize: 1, maxIterations: 500, onError: 'stop' },
  [NodeTypes.ACTION_SWITCH]: { label: 'Switch / Router', input: '', mode: 'value', cases: [{ id: 'case_1', label: 'Case 1', operator: 'equals', value: '' }], defaultHandle: 'default' },
  [NodeTypes.LOGIC_SWITCH]: { label: 'Switch / Router', input: '', mode: 'value', cases: [{ id: 'case_1', label: 'Case 1', operator: 'equals', value: '' }], defaultHandle: 'default' },
  [NodeTypes.LOGIC_CONDITION]: { label: 'If / Condition', combinator: 'and', conditions: [], leftValue: '', operator: 'equals', rightValue: '' },
  [NodeTypes.ACTION_CONDITION]: { label: 'If / Condition', combinator: 'and', conditions: [], leftValue: '', operator: 'equals', rightValue: '' },
});

export default DefaultNodeData;
