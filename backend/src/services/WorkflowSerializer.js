const crypto = require('crypto');
const { WorkflowSchemaVersion } = require('../constants');
const { serializationRegistry } = require('../serializers');
const WorkflowImportValidator = require('../validators/WorkflowImportValidator');

/**
 * WorkflowSerializer acts as the single source of truth for workflow export, import, versioning, and replay.
 */
class WorkflowSerializer {
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

    const workflowContent = {
      name: rawWorkflow.name || 'Untitled Workflow',
      description: rawWorkflow.description || '',
      status: rawWorkflow.status || 'draft',
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
   * Deserializes and validates a serialized JSON package back into a normalized workflow object
   * @param {object} serializedData - Serialized package
   * @returns {object} - Normalized workflow object
   */
  static deserialize(serializedData) {
    const validation = WorkflowImportValidator.validate(serializedData);
    if (!validation.valid) {
      throw new Error(`Workflow deserialization failed: ${validation.errors.join('; ')}`);
    }

    const wfData = serializedData.workflow || (serializedData.nodes ? serializedData : {});

    const nodes = serializationRegistry.deserializeNodes(wfData.nodes || []);
    const edges = serializationRegistry.deserializeEdges(wfData.edges || []);

    return {
      name: wfData.name || 'Untitled Workflow',
      description: wfData.description || '',
      status: wfData.status || 'draft',
      nodes,
      edges,
      schedule: wfData.schedule || { enabled: false, cron: '' },
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
