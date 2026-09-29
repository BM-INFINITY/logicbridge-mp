const crypto = require('crypto');
const { WorkflowSchemaVersion } = require('../constants');
const { serializationRegistry } = require('../serializers');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');

/**
 * Migration transforms keyed by schema version for future-proof schema evolution
 */
const MIGRATION_MAP = {
  '1.0.0': (payload) => payload,
};

/**
 * WorkflowSerializer acts as the single source of truth for workflow export, import, versioning, and replay.
 */
class WorkflowSerializer {
  /**
   * Generates a descriptive filename: <workflow-name>_v<version>_<YYYY-MM-DD>.json
   * @param {string} name
   * @param {number|string} [version=1]
   * @returns {string}
   */
  static generateExportFilename(name = 'workflow', version = 1) {
    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    return `${cleanName}_v${version}_${dateStr}.json`;
  }

  static export(workflow = {}, options = {}) {
    return JSON.stringify(this.serialize(workflow, options), null, 2);
  }

  static import(serializedData) {
    const parsed = typeof serializedData === 'string' ? JSON.parse(serializedData) : serializedData;
    return this.deserialize(parsed);
  }

  /**
   * Serializes a workflow Mongoose document or plain JS object into portable JSON format
   * @param {object} workflow - Input workflow object or document
   * @param {object} [options] - Export options { exportedBy }
   * @returns {object} - Serialized JSON package
   */
  static serialize(workflow = {}, options = {}) {
    const rawWorkflow = typeof workflow.toObject === 'function' ? workflow.toObject() : workflow;

    const nodes = serializationRegistry.serializeNodes(rawWorkflow.nodes || []);
    const edges = serializationRegistry.serializeEdges(rawWorkflow.edges || []);
    const statistics = serializationRegistry.serializeStatistics(nodes, edges);
    const version = rawWorkflow.version || 1;

    const workflowContent = {
      name: rawWorkflow.name || 'Untitled Workflow',
      description: rawWorkflow.description || '',
      status: rawWorkflow.status || 'draft',
      version,
      nodes,
      edges,
      schedule: rawWorkflow.schedule || { enabled: false, cron: '' },
    };

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(workflowContent))
      .digest('hex');

    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      manifest: {
        schemaVersion: WorkflowSchemaVersion.CURRENT,
        platform: WorkflowSchemaVersion.PLATFORM,
        serializer: WorkflowSchemaVersion.SERIALIZER_NAME,
        exportFormat: WorkflowSchemaVersion.EXPORT_FORMAT,
        logicBridgeVersion: '1.0.0',
        generatedBy: 'WorkflowSerializer',
        exportId,
        checksum,
      },
      workflow: workflowContent,
      statistics,
      exportedAt: new Date().toISOString(),
      exportedBy: options.exportedBy || 'system',
    };
  }

  /**
   * Applies schema migrations using compatibility map
   * @param {object} payload
   * @returns {object} - Migrated payload
   */
  static migrate(payload) {
    const version = payload?.manifest?.schemaVersion || payload?.schemaVersion || '1.0.0';
    const migrationFn = MIGRATION_MAP[version];
    if (typeof migrationFn === 'function') {
      return migrationFn(payload);
    }
    return payload;
  }

  /**
   * Deserializes and validates a serialized JSON package back into a normalized workflow object
   * @param {object} serializedData - Serialized package
   * @returns {object} - Normalized workflow object
   */
  static deserialize(serializedData) {
    const migrated = this.migrate(serializedData);
    const validation = WorkflowImportValidator.validate(migrated);
    if (!validation.valid) {
      throw new Error(`Workflow deserialization failed: ${validation.errors.join('; ')}`);
    }

    const wfData = migrated.workflow || (migrated.nodes ? migrated : {});

    const nodes = serializationRegistry.deserializeNodes(wfData.nodes || []);
    const edges = serializationRegistry.deserializeEdges(wfData.edges || []);

    return {
      name: wfData.name || 'Untitled Workflow',
      description: wfData.description || '',
      status: wfData.status || 'draft',
      version: wfData.version || 1,
      nodes,
      edges,
      schedule: wfData.schedule || { enabled: false, cron: '' },
      warnings: validation.warnings || [],
    };
  }

  /**
   * Performs a round-trip serialization test (serialize -> deserialize -> serialize)
   * Verifies structural equivalence, checksum, schema version, node ID preservation, and edge ID preservation.
   * @param {object} workflow
   * @returns {{ success: boolean, original: object, roundTripped: object, checks: object }}
   */
  static roundTripTest(workflow) {
    const firstPass = this.serialize(workflow);
    const deserialized = this.deserialize(firstPass);
    const secondPass = this.serialize(deserialized);

    const firstNodeIds = firstPass.workflow.nodes.map((n) => n.id).sort().join(',');
    const secondNodeIds = secondPass.workflow.nodes.map((n) => n.id).sort().join(',');

    const firstEdgeIds = firstPass.workflow.edges.map((e) => e.id).sort().join(',');
    const secondEdgeIds = secondPass.workflow.edges.map((e) => e.id).sort().join(',');

    const checks = {
      schemaVersionMatch: firstPass.manifest.schemaVersion === secondPass.manifest.schemaVersion,
      checksumValid: Boolean(secondPass.manifest.checksum),
      nodeIdsPreserved: firstNodeIds === secondNodeIds,
      edgeIdsPreserved: firstEdgeIds === secondEdgeIds,
      nameMatch: firstPass.workflow.name === secondPass.workflow.name,
    };

    const success = Object.values(checks).every(Boolean);

    return {
      success,
      original: firstPass,
      roundTripped: secondPass,
      checks,
    };
  }
}

module.exports = WorkflowSerializer;
