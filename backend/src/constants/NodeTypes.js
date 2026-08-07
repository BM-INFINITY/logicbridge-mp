/**
 * Catalog of supported node types in LogicBridge
 */
const NodeTypes = Object.freeze({
  // Triggers
  TRIGGER_MANUAL: 'trigger-manual',
  TRIGGER_SCHEDULE: 'trigger-schedule',
  TRIGGER_WEBHOOK: 'trigger-webhook',

  // Actions
  ACTION_HTTP: 'action-http',
  ACTION_LOG: 'action-log',
  ACTION_DELAY: 'action-delay',
  ACTION_TRANSFORM: 'action-transform',
  ACTION_EMAIL: 'action-email',
  ACTION_CSV: 'action-csv',

  // Logic
  LOGIC_CONDITION: 'logic-condition',
});

module.exports = NodeTypes;
