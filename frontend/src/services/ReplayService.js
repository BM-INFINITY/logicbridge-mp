import ExecutionSnapshot from '../models/ExecutionSnapshot.js';

/**
 * ReplayService — pure business logic for workflow execution replay.
 * Handles snapshot sequence construction, timeline cursor navigation, filtering architecture, and statistics.
 */
export const ReplayService = {
  /**
   * Constructs an array of immutable ExecutionSnapshot frames from an execution log object.
   *
   * @param {object} execution - Execution log document from backend
   * @param {Array} workflowNodes - Array of workflow React Flow nodes
   * @returns {ExecutionSnapshot[]} Array of snapshots starting from initial state
   */
  buildSnapshots(execution, workflowNodes = []) {
    if (!execution || !Array.isArray(execution.steps)) {
      return [ExecutionSnapshot.initial(workflowNodes)];
    }

    const snapshots = [ExecutionSnapshot.initial(workflowNodes)];

    // Cumulative state trackers
    const cumulativeStatusMap = {};
    workflowNodes.forEach((n) => { cumulativeStatusMap[n.id] = 'pending'; });

    const cumulativeBranches = {};
    const cumulativeEvents = [...snapshots[0].events];

    execution.steps.forEach((step, idx) => {
      const stepIndex = idx;

      // 1. Emit NODE_STARTED event
      cumulativeEvents.push({
        id: `evt_start_${step.nodeId}_${idx}`,
        stepIndex,
        nodeId: step.nodeId,
        nodeName: step.nodeName,
        nodeType: step.nodeType,
        type: 'NODE_STARTED',
        timestamp: step.startedAt || execution.startedAt,
        details: `Node "${step.nodeName}" started execution`,
      });

      // 2. Mark current node as running
      cumulativeStatusMap[step.nodeId] = 'running';

      // Intermediate snapshot for running status
      snapshots.push(
        new ExecutionSnapshot({
          snapshotId: `snap_running_${stepIndex}_${step.nodeId}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          status: 'running',
          nodeStatusMap: { ...cumulativeStatusMap },
          activeNodeId: step.nodeId,
          selectedBranches: { ...cumulativeBranches },
          events: [...cumulativeEvents],
          viewportFocus: { nodeId: step.nodeId },
          timestamp: step.startedAt || new Date().toISOString(),
          input: step.input,
          duration: 0,
        })
      );

      // 3. Mark step final status
      cumulativeStatusMap[step.nodeId] = step.status;

      // Condition branch tracking
      if (step.nodeType === 'logic-condition' && step.output?.selectedBranch) {
        cumulativeBranches[step.nodeId] = step.output.selectedBranch;

        cumulativeEvents.push({
          id: `evt_cond_${step.nodeId}_${idx}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          type: 'CONDITION_EVALUATED',
          timestamp: step.finishedAt || step.startedAt,
          details: `Condition evaluated to ${String(step.output.passed).toUpperCase()}`,
        });

        cumulativeEvents.push({
          id: `evt_branch_${step.nodeId}_${idx}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          type: 'BRANCH_SELECTED',
          timestamp: step.finishedAt || step.startedAt,
          details: `Selected branch "${step.output.selectedBranch.toUpperCase()}"`,
        });
      }

      // Final step status events
      if (step.status === 'skipped') {
        cumulativeEvents.push({
          id: `evt_skip_${step.nodeId}_${idx}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          type: 'NODE_SKIPPED',
          timestamp: step.finishedAt || step.startedAt,
          details: `Node "${step.nodeName}" skipped (${step.output?.skippedReason || 'Branch not selected'})`,
        });
      } else if (step.status === 'success') {
        cumulativeEvents.push({
          id: `evt_comp_${step.nodeId}_${idx}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          type: 'NODE_COMPLETED',
          timestamp: step.finishedAt || step.startedAt,
          details: `Node "${step.nodeName}" completed in ${step.duration || 0}ms`,
        });
      } else if (step.status === 'failed') {
        cumulativeEvents.push({
          id: `evt_fail_${step.nodeId}_${idx}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          type: 'NODE_FAILED',
          timestamp: step.finishedAt || step.startedAt,
          details: `Node "${step.nodeName}" failed: ${step.error}`,
        });
      }

      // Final step snapshot
      snapshots.push(
        new ExecutionSnapshot({
          snapshotId: `snap_finish_${stepIndex}_${step.nodeId}`,
          stepIndex,
          nodeId: step.nodeId,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          status: step.status,
          nodeStatusMap: { ...cumulativeStatusMap },
          activeNodeId: step.nodeId,
          selectedBranches: { ...cumulativeBranches },
          events: [...cumulativeEvents],
          viewportFocus: { nodeId: step.nodeId },
          timestamp: step.finishedAt || new Date().toISOString(),
          input: step.input,
          output: step.output,
          error: step.error,
          duration: step.duration || 0,
        })
      );
    });

    // Terminal summary event
    cumulativeEvents.push({
      id: 'evt_end',
      type: execution.status === 'success' ? 'EXECUTION_SUCCESS' : 'EXECUTION_FAILED',
      timestamp: execution.finishedAt || new Date().toISOString(),
      details: execution.status === 'success' ? 'Workflow execution finished successfully' : `Workflow execution failed: ${execution.error}`,
    });

    // Final terminal snapshot reflecting completed execution state with end event
    const lastStep = execution.steps[execution.steps.length - 1];
    if (lastStep) {
      snapshots.push(
        new ExecutionSnapshot({
          snapshotId: `snap_terminal_${execution._id || 'end'}`,
          stepIndex: execution.steps.length - 1,
          nodeId: lastStep.nodeId,
          nodeName: lastStep.nodeName,
          nodeType: lastStep.nodeType,
          status: execution.status,
          nodeStatusMap: { ...cumulativeStatusMap },
          activeNodeId: null,
          selectedBranches: { ...cumulativeBranches },
          events: [...cumulativeEvents],
          viewportFocus: { nodeId: lastStep.nodeId },
          timestamp: execution.finishedAt || new Date().toISOString(),
          input: lastStep.input,
          output: lastStep.output,
          error: execution.error,
          duration: execution.duration || 0,
        })
      );
    }

    return snapshots;
  },

  /**
   * Creates a TimelineCursor object for position tracking, seeking, and scrubbing.
   */
  createCursor(snapshotIndex, snapshots = []) {
    const totalSnapshots = snapshots.length;
    const clampedIndex = Math.max(0, Math.min(snapshotIndex, totalSnapshots - 1));
    const currentSnapshot = snapshots[clampedIndex] || null;

    let cumulativeMs = 0;
    for (let i = 0; i <= clampedIndex; i++) {
      cumulativeMs += snapshots[i]?.duration || 0;
    }

    return Object.freeze({
      index: clampedIndex,
      totalSnapshots,
      positionMs: cumulativeMs,
      snapshotId: currentSnapshot?.snapshotId || null,
      nodeId: currentSnapshot?.nodeId || null,
      isStart: clampedIndex === 0,
      isEnd: clampedIndex === totalSnapshots - 1,
    });
  },

  /**
   * Timeline filtering architecture for future filter criteria (status, nodeType, search query).
   */
  filterSnapshots(snapshots = [], filters = {}) {
    if (!filters || Object.keys(filters).length === 0) return snapshots;

    const { status, nodeType, search } = filters;

    return snapshots.filter((snap) => {
      if (snap.stepIndex === -1) return true; // Keep initial frame
      if (status && status !== 'all' && snap.status !== status) return false;
      if (nodeType && snap.nodeType !== nodeType) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = snap.nodeName?.toLowerCase().includes(q);
        const matchId = snap.nodeId?.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }
      return true;
    });
  },

  /**
   * Calculates execution statistics.
   */
  calculateStatistics(execution, snapshots = []) {
    if (!execution) {
      return {
        totalDuration: 0,
        executedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        successRate: 0,
        selectedBranches: [],
        triggerType: 'manual',
      };
    }

    const steps = execution.steps || [];
    const executedCount = steps.filter((s) => s.status === 'success').length;
    const skippedCount = steps.filter((s) => s.status === 'skipped').length;
    const failedCount = steps.filter((s) => s.status === 'failed').length;
    const totalExecuted = executedCount + failedCount;
    const successRate = totalExecuted > 0 ? Math.round((executedCount / totalExecuted) * 100) : 100;

    const lastSnap = snapshots[snapshots.length - 1];
    const selectedBranches = Object.entries(lastSnap?.selectedBranches || {}).map(([nodeId, selectedBranch]) => ({
      nodeId,
      selectedBranch,
    }));

    return {
      totalDuration: execution.duration || 0,
      executedCount,
      skippedCount,
      failedCount,
      successRate,
      selectedBranches,
      triggerType: execution.trigger || 'manual',
    };
  },
};

export default ReplayService;
