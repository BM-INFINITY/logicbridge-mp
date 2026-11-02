import { addEdge } from 'reactflow';
import toast from 'react-hot-toast';
import { builderConfig } from '../config/builderConfig.js';
import { BranchColors } from '../constants/BranchColors.js';

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
   * Creates a styled edge object for React Flow connections with branch styling & validation
   * @param {object} params - Connection parameters { source, target, sourceHandle, targetHandle }
   * @param {Array} existingEdges - Current edges array
   * @returns {Array} - Updated edges array
   */
  static connectEdges(params, existingEdges) {
    // Check condition and switch handle duplicate connection rules
    if (params.sourceHandle && params.sourceHandle !== 'null') {
      const isUniqueHandle = ['true', 'false', 'loop', 'done', 'default'].includes(params.sourceHandle) ||
        params.sourceHandle.startsWith('case_');
      if (isUniqueHandle) {
        const duplicate = existingEdges.find(
          (e) => e.source === params.source && e.sourceHandle === params.sourceHandle
        );
        if (duplicate) {
          toast.error(`Node already has a connection from branch "${params.sourceHandle.toUpperCase()}".`);
          return existingEdges;
        }
      }
    }

    const isTrue = params.sourceHandle === 'true';
    const isFalse = params.sourceHandle === 'false';
    const isLoop = params.sourceHandle === 'loop';
    const isDone = params.sourceHandle === 'done';
    const isSwitchCase = params.sourceHandle && params.sourceHandle.startsWith('case_');
    const isSwitchDefault = params.sourceHandle === 'default';

    const branch = isTrue
      ? 'true'
      : isFalse
      ? 'false'
      : isLoop
      ? 'loop'
      : isDone
      ? 'done'
      : (params.sourceHandle || 'default');

    const edgeColor = isTrue
      ? BranchColors.TRUE
      : isFalse
      ? BranchColors.FALSE
      : isLoop
      ? (BranchColors.LOOP || '#06b6d4')
      : isDone
      ? (BranchColors.DONE || '#10b981')
      : isSwitchCase
      ? (BranchColors.SWITCH || '#8b5cf6')
      : isSwitchDefault
      ? (BranchColors.SWITCH_DEFAULT || '#64748b')
      : BranchColors.DEFAULT;

    const labelText = isTrue
      ? 'True'
      : isFalse
      ? 'False'
      : isLoop
      ? 'Loop'
      : isDone
      ? 'Done'
      : isSwitchCase
      ? params.sourceHandle.replace('case_', 'Case ')
      : isSwitchDefault
      ? 'Default'
      : undefined;

    const edgePayload = {
      ...params,
      branch,
      data: { ...(params.data || {}), branch },
      animated: builderConfig.defaultEdgeOptions.animated,
      label: labelText,
      labelStyle: labelText ? { fill: edgeColor, fontWeight: 700, fontSize: 11 } : undefined,
      labelBgStyle: labelText ? { fill: 'var(--bg-card)', color: edgeColor } : undefined,
      style: { stroke: edgeColor, strokeWidth: 2 },
    };

    return addEdge(edgePayload, existingEdges);
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
