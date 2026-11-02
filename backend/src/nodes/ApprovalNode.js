const BaseNode = require('./BaseNode');
const { NodeTypes, BranchTypes } = require('../constants');
const { resolveVariable } = require('../utils/VariableResolver');
const ExecutionPauseSignal = require('../errors/ExecutionPauseSignal');

/**
 * ApprovalNode — Pauses workflow execution for human review and approval.
 * Resumes along 'approved', 'rejected', or 'timeout' execution branches.
 */
class ApprovalNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_APPROVAL,
      name: 'Human Approval',
      category: 'action',
      icon: 'UserCheck',
      description: 'Pauses workflow execution until approved or rejected by an authorized reviewer',
      version: '1.0.0',
    });
  }

  /**
   * Validates approval node configuration
   * @param {object} node
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(node) {
    const data = node.data || {};
    if (!data.title || String(data.title).trim() === '') {
      return { valid: false, error: 'Approval title is required' };
    }

    if (data.timeoutMinutes !== undefined && data.timeoutMinutes !== null && data.timeoutMinutes !== '') {
      const tm = parseInt(data.timeoutMinutes, 10);
      if (isNaN(tm) || tm < 1) {
        return { valid: false, error: 'Timeout minutes must be a positive integer greater than or equal to 1' };
      }
    }

    if (data.timeoutAction && !['reject', 'approve'].includes(String(data.timeoutAction).toLowerCase())) {
      return { valid: false, error: 'Timeout action must be either "reject" or "approve"' };
    }

    return { valid: true };
  }

  /**
   * Executes or pauses the approval step
   * @param {object} node
   * @param {object} context
   * @returns {object}
   */
  async execute(node, context) {
    const data = node.data || {};

    // Check if this node is resuming after human decision or timeout
    const resuming = context.resumingApproval;
    if (resuming && (resuming.nodeId === node.id || !resuming.nodeId)) {
      const isTimeout = resuming.status === 'timeout';
      const decision = resuming.decision || (resuming.status === 'approved' ? 'approved' : 'rejected');

      let selectedBranch = BranchTypes.APPROVED;
      if (isTimeout) {
        selectedBranch = BranchTypes.TIMEOUT;
      } else if (decision === 'rejected') {
        selectedBranch = BranchTypes.REJECTED;
      }

      return {
        approvalId: resuming.approvalId || `appr_${Date.now()}`,
        nodeId: node.id,
        title: resolveVariable(data.title || 'Approval Request', context),
        status: isTimeout ? 'timeout' : (decision === 'approved' ? 'approved' : 'rejected'),
        decision: isTimeout ? null : decision,
        decidedBy: resuming.decidedBy || 'system',
        decidedAt: resuming.decidedAt || new Date().toISOString(),
        comments: resuming.comments || '',
        selectedBranch,
        resumed: true,
      };
    }

    // Initial execution: resolve dynamic fields and signal engine to pause
    const title = resolveVariable(data.title || 'Approval Request', context);
    const description = resolveVariable(data.description || '', context);
    const message = resolveVariable(data.message || '', context);

    let allowedApprovers = [];
    if (Array.isArray(data.allowedApprovers)) {
      allowedApprovers = data.allowedApprovers
        .map((a) => resolveVariable(String(a), context).trim())
        .filter(Boolean);
    } else if (typeof data.allowedApprovers === 'string' && data.allowedApprovers.trim()) {
      allowedApprovers = data.allowedApprovers
        .split(',')
        .map((s) => resolveVariable(s, context).trim())
        .filter(Boolean);
    }

    const approverRole = data.approverRole
      ? resolveVariable(String(data.approverRole), context).trim()
      : null;

    let timeoutMinutes = null;
    if (data.timeoutMinutes !== undefined && data.timeoutMinutes !== null && data.timeoutMinutes !== '') {
      const tm = parseInt(resolveVariable(String(data.timeoutMinutes), context), 10);
      if (!isNaN(tm) && tm > 0) timeoutMinutes = tm;
    }

    const timeoutAction = String(data.timeoutAction || 'reject').toLowerCase().trim() === 'approve'
      ? 'approve'
      : 'reject';

    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    throw new ExecutionPauseSignal('approval', {
      approvalId,
      nodeId: node.id,
      title,
      description,
      message,
      allowedApprovers,
      approverRole,
      timeoutMinutes,
      timeoutAction,
    });
  }
}

module.exports = ApprovalNode;
