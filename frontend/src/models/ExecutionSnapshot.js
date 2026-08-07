/**
 * ExecutionSnapshot — immutable model representing a single frame of replay.
 *
 * Replay moves between precomputed snapshots rather than mutating live node objects.
 */
export class ExecutionSnapshot {
  constructor({
    snapshotId,
    stepIndex,
    nodeId,
    nodeName,
    nodeType,
    status,
    nodeStatusMap = {},
    activeNodeId = null,
    selectedBranches = {},
    events = [],
    viewportFocus = null,
    timestamp = null,
    input = null,
    output = null,
    error = null,
    duration = 0,
  }) {
    this.snapshotId = snapshotId || `snap_${stepIndex}_${nodeId}`;
    this.stepIndex = stepIndex;
    this.nodeId = nodeId;
    this.nodeName = nodeName || nodeId;
    this.nodeType = nodeType || 'unknown';
    this.status = status; // 'pending' | 'running' | 'success' | 'failed' | 'skipped'

    // Deep freeze maps to guarantee immutability
    this.nodeStatusMap = Object.freeze({ ...nodeStatusMap });
    this.activeNodeId = activeNodeId;
    this.selectedBranches = Object.freeze({ ...selectedBranches });
    this.events = Object.freeze([...events]);
    this.viewportFocus = viewportFocus ? Object.freeze({ ...viewportFocus }) : null;
    this.timestamp = timestamp || new Date().toISOString();

    this.input = input ? Object.freeze(JSON.parse(JSON.stringify(input))) : null;
    this.output = output ? Object.freeze(JSON.parse(JSON.stringify(output))) : null;
    this.error = error;
    this.duration = duration;

    Object.freeze(this);
  }

  /**
   * Factory method to construct an initial baseline snapshot (step -1)
   */
  static initial(nodes = []) {
    const nodeStatusMap = {};
    nodes.forEach((n) => {
      nodeStatusMap[n.id] = 'pending';
    });

    return new ExecutionSnapshot({
      snapshotId: 'snap_initial',
      stepIndex: -1,
      nodeId: 'start',
      nodeName: 'Execution Start',
      nodeType: 'system',
      status: 'pending',
      nodeStatusMap,
      activeNodeId: null,
      selectedBranches: {},
      events: [{ id: 'evt_start', type: 'EXECUTION_STARTED', timestamp: new Date().toISOString(), details: 'Workflow execution initialized' }],
      viewportFocus: null,
      timestamp: new Date().toISOString(),
    });
  }
}

export default ExecutionSnapshot;
