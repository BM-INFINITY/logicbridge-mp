import { addEdge } from 'reactflow';
import { builderConfig } from '../config/builderConfig';

/**
 * Adapter isolating React Flow specific graph utility functions
 */
export class ReactFlowAdapter {
  /**
   * Converts screen pixel drop coordinates to canvas flow position
   * @param {object} rfInstance - React Flow instance
   * @param {object} wrapperRef - React Flow wrapper container ref
   * @param {number} clientX - Event clientX
   * @param {number} clientY - Event clientY
   * @returns {object} - { x, y } flow position
   */
  static screenToFlowPosition(rfInstance, wrapperRef, clientX, clientY) {
    if (!rfInstance || !wrapperRef?.current) return { x: 100, y: 100 };
    const bounds = wrapperRef.current.getBoundingClientRect();
    return rfInstance.screenToFlowPosition({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    });
  }

  /**
   * Creates a styled edge object for React Flow connections
   * @param {object} params - Connection parameters { source, target, sourceHandle, targetHandle }
   * @param {Array} existingEdges - Current edges array
   * @returns {Array} - Updated edges array
   */
  static connectEdges(params, existingEdges) {
    return addEdge(
      {
        ...params,
        animated: builderConfig.defaultEdgeOptions.animated,
        style: builderConfig.defaultEdgeOptions.style,
      },
      existingEdges
    );
  }

  /**
   * Prepares a new node object payload
   * @param {string} type - Node type key
   * @param {object} position - { x, y } position
   * @param {string} label - Node display label
   * @returns {object}
   */
  static createNodePayload(type, position, label) {
    return {
      id: `node_${Date.now()}`,
      type,
      position,
      data: { label: label || type },
    };
  }
}

export default ReactFlowAdapter;
