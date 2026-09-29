import { NodeTypes } from './NodeTypes';

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
  [NodeTypes.LOGIC_CONDITION]: { label: 'If / Condition', leftValue: '', operator: 'equals', rightValue: '' },
});

export default DefaultNodeData;
