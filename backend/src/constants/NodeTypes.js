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
  ACTION_JSON: 'action-json',
  ACTION_TEXT: 'action-text',
  ACTION_MATH: 'action-math',
  ACTION_DATE: 'action-date',
  ACTION_POSTGRES: 'action-postgres',
  ACTION_MONGODB: 'action-mongodb',
  ACTION_GOOGLE_SHEETS: 'action-google-sheets',
  ACTION_SLACK: 'action-slack',
  ACTION_DISCORD: 'action-discord',
  ACTION_FILE: 'action-file',
  ACTION_STORAGE: 'action-storage',
  ACTION_LOOP: 'action-loop',
  ACTION_SWITCH: 'action-switch',
  ACTION_APPROVAL: 'action-approval',
  ACTION_WAIT: 'action-wait',

  // AI / LLM
  ACTION_AI_GENERATE: 'action-ai-generate',
  ACTION_AI_CHAT: 'action-ai-chat',
  ACTION_AI_STRUCTURED: 'action-ai-structured',
  ACTION_AI_CLASSIFY: 'action-ai-classify',
  ACTION_AI_EMBEDDINGS: 'action-ai-embeddings',

  // Logic
  LOGIC_CONDITION: 'logic-condition',
  ACTION_CONDITION: 'action-condition',
  LOGIC_SWITCH: 'logic-switch',
});

module.exports = NodeTypes;
