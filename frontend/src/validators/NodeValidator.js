import { NodeTypes } from '../constants/NodeTypes';

/**
 * Frontend validation rules for step configuration and branch connection logic
 */
export class NodeValidator {
  /**
   * Validates a node's data payload before testing or execution
   * @param {object} node - React Flow node object
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateNode(node) {
    if (!node) return { valid: false, error: 'No step selected' };
    const { type, data } = node;

    if (type === NodeTypes.ACTION_HTTP) {
      if (!data?.url || !data.url.trim()) {
        return { valid: false, error: 'HTTP URL is required' };
      }
    }

    if (type === NodeTypes.ACTION_CSV) {
      if (!data?.columns || (Array.isArray(data.columns) && data.columns.length === 0)) {
        return { valid: false, error: 'At least one CSV column definition is required' };
      }
    }

    if (type === NodeTypes.ACTION_TRANSFORM) {
      if (data?.template) {
        try {
          JSON.parse(data.template);
        } catch {
          return { valid: false, error: 'Transform template must be valid JSON' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validates if a new condition edge connection is allowed
   * @param {object} params - Connection parameters { source, target, sourceHandle }
   * @param {Array} edges - Existing edge list
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateConditionConnection(params, edges) {
    if (params.sourceHandle === 'true' || params.sourceHandle === 'false') {
      const duplicate = edges.find(
        (e) => e.source === params.source && e.sourceHandle === params.sourceHandle
      );
      if (duplicate) {
        return {
          valid: false,
          error: `Condition node already has a ${params.sourceHandle.toUpperCase()} branch connection`,
        };
      }
    }
    return { valid: true };
  }
}

export default NodeValidator;
