const VariableResolver = require('./VariableResolver');
const CsvGenerator = require('./CsvGenerator');
const TemplateResolver = require('./TemplateResolver');
const ExecutionLogger = require('./ExecutionLogger');
const ExecutionContext = require('./ExecutionContext');
const ResponseHelper = require('./ResponseHelper');
const ExecutionPath = require('./ExecutionPath');
const TriggerContext = require('./TriggerContext');
const WebhookPayload = require('./WebhookPayload');
const SecretRedactor = require('./SecretRedactor');
const FileSecurity = require('./FileSecurity');
const ConditionEvaluator = require('./ConditionEvaluator');

module.exports = {
  VariableResolver,
  CsvGenerator,
  TemplateResolver,
  ExecutionLogger,
  ExecutionContext,
  ResponseHelper,
  ExecutionPath,
  TriggerContext,
  WebhookPayload,
  SecretRedactor,
  FileSecurity,
  ConditionEvaluator,
  resolveVariable: VariableResolver.resolveVariable,
  resolveRawValue: VariableResolver.resolveRawValue,
  generateCsvFile: CsvGenerator.generateFile,
  transformTemplate: TemplateResolver.transformTemplate,
  logExecution: ExecutionLogger.logExecution,
  logError: ExecutionLogger.logError,
  success: ResponseHelper.success,
  error: ResponseHelper.error,
  redactSecrets: SecretRedactor.redactSecrets,
  registerActiveSecrets: SecretRedactor.registerActiveSecrets,
  clearActiveSecrets: SecretRedactor.clearActiveSecrets,
  runWithScope: SecretRedactor.runWithScope,
  RedactionScope: SecretRedactor.RedactionScope,
  getActiveScope: SecretRedactor.getActiveScope,
  resolveSafePath: FileSecurity.resolveSafePath,
  buildFileReference: FileSecurity.buildFileReference,
  evaluateCondition: ConditionEvaluator.evaluateCondition,
};
