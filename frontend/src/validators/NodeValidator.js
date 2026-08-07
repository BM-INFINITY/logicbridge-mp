import { NodeTypes } from '../constants/NodeTypes';

/**
 * Frontend validation rules for step configuration
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
}

export default NodeValidator;
