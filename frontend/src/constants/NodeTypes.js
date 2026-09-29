export const NodeTypes = Object.freeze({
  TRIGGER_MANUAL: 'trigger-manual',
  TRIGGER_SCHEDULE: 'trigger-schedule',
  TRIGGER_WEBHOOK: 'trigger-webhook',
  ACTION_HTTP: 'action-http',
  ACTION_LOG: 'action-log',
  ACTION_DELAY: 'action-delay',
  ACTION_TRANSFORM: 'action-transform',
  ACTION_EMAIL: 'action-email',
  ACTION_CSV: 'action-csv',
  ACTION_JSON: 'action-json',
  ACTION_TEXT: 'action-text',
  ACTION_MATH: 'action-math',
  ACTION_DATE: 'action-date',
  ACTION_POSTGRES: 'action-postgres',
  ACTION_MONGODB: 'action-mongodb',
  LOGIC_CONDITION: 'logic-condition',
});

export default NodeTypes;
