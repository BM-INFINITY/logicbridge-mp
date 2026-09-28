const BaseNode = require('./BaseNode');
const ManualTriggerNode = require('./ManualTriggerNode');
const ScheduleTriggerNode = require('./ScheduleTriggerNode');
const WebhookTriggerNode = require('./WebhookTriggerNode');
const HttpNode = require('./HttpNode');
const LogNode = require('./LogNode');
const DelayNode = require('./DelayNode');
const TransformNode = require('./TransformNode');
const ConditionNode = require('./ConditionNode');
const CsvNode = require('./CsvNode');
const EmailNode = require('./EmailNode');
const JsonNode = require('./JsonNode');
const TextNode = require('./TextNode');
const MathNode = require('./MathNode');
const DateNode = require('./DateNode');
const registry = require('./registry');

// Auto-register default node handlers into registry singleton
const defaultNodes = [
  new ManualTriggerNode(),
  new ScheduleTriggerNode(),
  new WebhookTriggerNode(),
  new HttpNode(),
  new LogNode(),
  new DelayNode(),
  new TransformNode(),
  new ConditionNode(),
  new CsvNode(),
  new EmailNode(),
  new JsonNode(),
  new TextNode(),
  new MathNode(),
  new DateNode(),
];

defaultNodes.forEach(nodeInstance => registry.register(nodeInstance));

module.exports = {
  registry,
  BaseNode,
  ManualTriggerNode,
  ScheduleTriggerNode,
  WebhookTriggerNode,
  HttpNode,
  LogNode,
  DelayNode,
  TransformNode,
  ConditionNode,
  CsvNode,
  EmailNode,
  JsonNode,
  TextNode,
  MathNode,
  DateNode,
};
