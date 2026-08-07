import { NodeTypes } from './NodeTypes';

export const DefaultNodeData = Object.freeze({
  [NodeTypes.TRIGGER_MANUAL]: { label: 'Manual Start' },
  [NodeTypes.TRIGGER_SCHEDULE]: { label: 'Schedule Trigger', cron: '0 8 * * *' },
  [NodeTypes.TRIGGER_WEBHOOK]: { label: 'Webhook Listener' },
  [NodeTypes.ACTION_HTTP]: { label: 'HTTP Request', method: 'GET', url: '' },
  [NodeTypes.ACTION_LOG]: { label: 'Log Output', message: '' },
  [NodeTypes.ACTION_DELAY]: { label: 'Delay', seconds: 1 },
  [NodeTypes.ACTION_TRANSFORM]: { label: 'Transform Data', template: '' },
  [NodeTypes.ACTION_CSV]: { label: 'Generate CSV', filename: 'report', delimiter: ',' },
  [NodeTypes.LOGIC_CONDITION]: { label: 'If / Condition', leftValue: '', operator: 'equals', rightValue: '' },
});

export default DefaultNodeData;
