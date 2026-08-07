const SCHEMA_VERSION = '1.0.0';
const PLATFORM = 'LogicBridge';

/**
 * Client-side Workflow Serializer utility mirroring backend serialization rules
 */
export class WorkflowSerializer {
  /**
   * Generates descriptive export filename: <workflow-name>_v<version>_<YYYY-MM-DD>.json
   * @param {string} name
   * @param {number|string} [version=1]
   * @returns {string}
   */
  static generateExportFilename(name = 'workflow', version = 1) {
    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    return `${cleanName}_v${version}_${dateStr}.json`;
  }

  /**
   * Serializes React Flow canvas nodes & edges into portable JSON payload format
   * @param {object} workflow - Workflow object { name, description, nodes, edges, schedule, status }
   * @param {object} [options] - Export options
   * @returns {object} - Serialized JSON package
   */
  static serialize(workflow = {}, options = {}) {
    const nodes = (workflow.nodes || []).map((node) => ({
      id: String(node.id),
      type: String(node.type),
      position: node.position || { x: 0, y: 0 },
      data: { ...(node.data || {}) },
    }));

    const edges = (workflow.edges || []).map((edge) => ({
      id: String(edge.id || `edge_${edge.source}_${edge.target}`),
      source: String(edge.source),
      target: String(edge.target),
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      branch: edge.branch || edge.data?.branch || (edge.sourceHandle === 'true' ? 'true' : edge.sourceHandle === 'false' ? 'false' : 'default'),
      label: edge.label || null,
      animated: edge.animated ?? true,
      style: edge.style || null,
    }));

    let conditionCount = 0;
    let triggerCount = 0;
    let actionCount = 0;

    for (const n of nodes) {
      if (n.type === 'logic-condition') conditionCount++;
      else if (String(n.type).startsWith('trigger-')) triggerCount++;
      else if (String(n.type).startsWith('action-')) actionCount++;
    }

    return {
      manifest: {
        schemaVersion: SCHEMA_VERSION,
        platform: PLATFORM,
        serializer: 'workflow',
        exportFormat: 'json',
        logicBridgeVersion: '1.0.0',
        generatedBy: 'WorkflowSerializer',
      },
      workflow: {
        name: workflow.name || 'Untitled Workflow',
        description: workflow.description || '',
        status: workflow.status || 'draft',
        version: workflow.version || 1,
        nodes,
        edges,
        schedule: workflow.schedule || { enabled: false, cron: '' },
      },
      statistics: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        conditionCount,
        triggerCount,
        actionCount,
      },
      exportedAt: new Date().toISOString(),
      exportedBy: options.exportedBy || 'client',
    };
  }

  /**
   * Validates client-side import payload
   * @param {object} payload
   * @returns {{ valid: boolean, error?: string }}
   */
  static validate(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be a valid JSON object' };
    }

    const version = payload.manifest?.schemaVersion || payload.schemaVersion;
    if (!version) {
      return { valid: false, error: 'Missing schemaVersion' };
    }

    if (version !== SCHEMA_VERSION) {
      return { valid: false, error: `Unsupported schema version "${version}"` };
    }

    const wfData = payload.workflow || payload;
    if (!wfData.nodes || !Array.isArray(wfData.nodes)) {
      return { valid: false, error: 'Invalid or missing "nodes" array' };
    }

    return { valid: true };
  }

  /**
   * Deserializes a package back into React Flow canvas state
   * @param {object} serializedData
   * @returns {object} - { name, description, nodes, edges, schedule, status, version }
   */
  static deserialize(serializedData) {
    const validation = this.validate(serializedData);
    if (!validation.valid) {
      throw new Error(`Deserialization failed: ${validation.error}`);
    }

    const wfData = serializedData.workflow || serializedData;
    return {
      name: wfData.name || 'Untitled Workflow',
      description: wfData.description || '',
      status: wfData.status || 'draft',
      version: wfData.version || 1,
      nodes: wfData.nodes || [],
      edges: wfData.edges || [],
      schedule: wfData.schedule || { enabled: false, cron: '' },
    };
  }
}

export default WorkflowSerializer;
