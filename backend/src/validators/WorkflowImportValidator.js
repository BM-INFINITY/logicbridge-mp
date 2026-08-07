const crypto = require('crypto');
const { WorkflowSchemaVersion } = require('../constants');
const { serializationRegistry } = require('../serializers');

/**
 * Validates serialized workflow payloads prior to import or deserialization
 */
class WorkflowImportValidator {
  /**
   * Validates a serialized workflow package
   * @param {object} payload - Serialized JSON payload
   * @returns {{ valid: boolean, errors: Array<string>, warnings: Array<string> }}
   */
  static validate(payload) {
    const errors = [];
    const warnings = [];

    if (!payload || typeof payload !== 'object') {
      return { valid: false, errors: ['Import payload must be a valid JSON object'], warnings: [] };
    }

    const manifest = payload.manifest || {};
    const schemaVersion = manifest.schemaVersion || payload.schemaVersion;

    if (!schemaVersion) {
      errors.push('Missing required field "schemaVersion" or "manifest.schemaVersion"');
    } else if (!WorkflowSchemaVersion.SUPPORTED.includes(schemaVersion)) {
      errors.push(`Unsupported schema version "${schemaVersion}". Supported versions: ${WorkflowSchemaVersion.SUPPORTED.join(', ')}`);
    }

    const workflowData = payload.workflow || (payload.nodes ? payload : null);
    if (!workflowData) {
      errors.push('Missing required object "workflow"');
    } else {
      const nodes = workflowData.nodes || [];
      const edges = workflowData.edges || [];

      // Validate nodes
      const nodeValidation = serializationRegistry.validateNodes(nodes);
      if (!nodeValidation.valid) {
        errors.push(nodeValidation.error);
      }

      // Validate edges
      const edgeValidation = serializationRegistry.validateEdges(edges, nodes);
      if (!edgeValidation.valid) {
        errors.push(edgeValidation.error);
      }

      // Checksum validation if present in manifest
      if (manifest.checksum) {
        try {
          const calculatedChecksum = crypto
            .createHash('sha256')
            .update(JSON.stringify(workflowData))
            .digest('hex');
          if (manifest.checksum !== calculatedChecksum) {
            warnings.push('Checksum mismatch: Workflow content may have been modified outside LogicBridge');
          }
        } catch {
          warnings.push('Unable to verify payload checksum');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

module.exports = WorkflowImportValidator;
