const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const { registry } = require('../nodes');
const { logError, ExecutionContext, ExecutionPath, TriggerContext, redactSecrets } = require('../utils');
const { ExecutionStatus, NodeTypes, ExecutionEvents, BranchTypes } = require('../constants');
const { ValidationError } = require('../errors');
const BranchTraversal = require('./BranchTraversal');
const { validateConditionBranches } = require('../validators/workflowValidator');

const MAX_LOOP_DEPTH = 5;

/**
 * Topological Sort via edges (Kahn's Algorithm with x-position fallback)
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @returns {Array} - Execution order array of nodes
 */
function buildExecutionOrder(nodes, edges) {
  if (!edges || edges.length === 0) {
    return [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = {};
  const adjacency = {};
  nodes.forEach((n) => { inDegree[n.id] = 0; adjacency[n.id] = []; });

  edges.forEach((e) => {
    if (nodeMap.has(e.source) && nodeMap.has(e.target)) {
      adjacency[e.source] = adjacency[e.source] || [];
      adjacency[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    (adjacency[node.id] || []).forEach((targetId) => {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        const targetNode = nodeMap.get(targetId);
        if (targetNode) queue.push(targetNode);
      }
    });
  }

  return order.length === nodes.length
    ? order
    : [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
}

/**
 * Identifies the set of node IDs that belong to the loop body of a LoopNode
 * @param {string} loopNodeId - ID of the LoopNode
 * @param {Array} nodes - All workflow nodes
 * @param {Array} edges - All workflow edges
 * @returns {Set<string>} - Set of node IDs in the loop body
 */
function findLoopBodyNodeIds(loopNodeId, nodes, edges = []) {
  const loopEdges = edges.filter((e) => e.source === loopNodeId && e.sourceHandle === 'loop');
  if (loopEdges.length === 0) return new Set();

  const doneEdges = edges.filter(
    (e) => e.source === loopNodeId && (e.sourceHandle === 'done' || (!e.sourceHandle && e.sourceHandle !== 'loop'))
  );

  // Discover all nodes downstream of done edges
  const doneReachable = new Set();
  const doneQueue = doneEdges.map((e) => e.target);
  while (doneQueue.length) {
    const cur = doneQueue.shift();
    if (doneReachable.has(cur)) continue;
    doneReachable.add(cur);
    edges
      .filter((e) => e.source === cur && e.source !== loopNodeId)
      .forEach((e) => doneQueue.push(e.target));
  }

  // Discover all nodes downstream of loop edges until converging with doneReachable
  const loopBodySet = new Set();
  const loopQueue = loopEdges.map((e) => e.target);

  while (loopQueue.length) {
    const cur = loopQueue.shift();
    if (loopBodySet.has(cur) || doneReachable.has(cur) || cur === loopNodeId) continue;
    loopBodySet.add(cur);
    edges
      .filter((e) => e.source === cur && e.target !== loopNodeId)
      .forEach((e) => loopQueue.push(e.target));
  }

  return loopBodySet;
}

/**
 * Executes a single standard node step within an execution context and records execution state
 * @param {object} node
 * @param {ExecutionContext} context
 * @param {ExecutionPath} executionPath
 * @param {Array} steps
 * @param {object} workflow
 * @param {object} [metadata] - { iteration, loopNodeId, batch }
 * @returns {Promise<any>} Output of node execution
 */
async function executeNodeStep(node, context, executionPath, steps, workflow, metadata = {}) {
  const stepStart = Date.now();
  const handler = registry.get(node.type);

  if (!handler) {
    console.warn(`No registered handler for node type: ${node.type}`);
    return null;
  }

  executionPath.recordVisited(node.id);
  executionPath.emitEvent(ExecutionEvents.NODE_STARTED, { nodeId: node.id, nodeType: node.type, ...metadata });

  const step = {
    nodeId: node.id,
    nodeName: node.data?.label || node.type,
    nodeType: node.type,
    status: ExecutionStatus.SUCCESS,
    input: redactSecrets({
      ...node.data,
      _previousOutput: context.lastOutput,
      _triggerContext: context.triggerContext,
      _iteration: metadata.iteration,
    }),
    output: null,
    error: null,
    duration: 0,
    startedAt: new Date(stepStart),
    finishedAt: null,
    ...(metadata.iteration !== undefined ? { iteration: metadata.iteration } : {}),
    ...(metadata.loopNodeId ? { loopNodeId: metadata.loopNodeId } : {}),
    ...(metadata.batch !== undefined ? { batch: metadata.batch } : {}),
  };

  try {
    if (typeof handler.validate === 'function') {
      const validation = handler.validate(node);
      if (validation && validation.valid === false) {
        throw new ValidationError(validation.error || `Validation failed for node "${step.nodeName}"`);
      }
    }

    const output = await handler.execute(node, context);
    step.output = redactSecrets(output);
    context.setResult(node.id, output);

    if (node.type === NodeTypes.LOGIC_CONDITION && output?.selectedBranch) {
      executionPath.recordBranch(node.id, output.selectedBranch);
      executionPath.emitEvent(ExecutionEvents.CONDITION_EVALUATED, { nodeId: node.id, passed: output.passed });
      executionPath.emitEvent(ExecutionEvents.BRANCH_SELECTED, { nodeId: node.id, selectedBranch: output.selectedBranch });
    }

    executionPath.emitEvent(ExecutionEvents.NODE_COMPLETED, { nodeId: node.id, nodeType: node.type, ...metadata });

    step.finishedAt = new Date();
    step.duration = Date.now() - stepStart;
    steps.push(step);

    return output;
  } catch (err) {
    step.status = ExecutionStatus.FAILED;
    step.error = err.message;
    step.finishedAt = new Date();
    step.duration = Date.now() - stepStart;
    steps.push(step);

    logError(step.nodeName, err, {
      workflowId: String(workflow._id),
      nodeId: node.id,
      nodeName: step.nodeName,
      nodeType: node.type,
      iteration: metadata.iteration,
    });

    throw err;
  }
}

/**
 * Orchestrates loop execution across collection items or batches, recursively supporting nested loops
 * @param {object} node
 * @param {ExecutionContext} context
 * @param {ExecutionPath} executionPath
 * @param {Array} steps
 * @param {object} workflow
 * @param {object} executedOutputs
 * @param {Set} handledLoopBodyNodes
 * @param {object} [metadata]
 * @returns {Promise<object>} Loop node output
 */
async function executeLoopStep(node, context, executionPath, steps, workflow, executedOutputs, handledLoopBodyNodes, metadata = {}) {
  const stepStart = Date.now();
  const handler = registry.get(node.type);

  if (!handler) {
    throw new Error(`Handler not found for loop node: ${node.type}`);
  }

  // Prevent nested loops beyond MAX_LOOP_DEPTH
  const currentDepth = context.loopStack ? context.loopStack.length : 0;
  if (currentDepth >= MAX_LOOP_DEPTH) {
    throw new Error(`Maximum loop depth (${MAX_LOOP_DEPTH}) exceeded in node "${node.data?.label || node.id}"`);
  }

  const loopBodySet = findLoopBodyNodeIds(node.id, workflow.nodes, workflow.edges);
  const loopBodyNodes = workflow.nodes.filter((n) => loopBodySet.has(n.id));
  const orderedLoopBody = buildExecutionOrder(loopBodyNodes, workflow.edges);

  executionPath.recordVisited(node.id);
  executionPath.emitEvent(ExecutionEvents.LOOP_STARTED, { nodeId: node.id, nodeType: node.type, ...metadata });

  const loopStep = {
    nodeId: node.id,
    nodeName: node.data?.label || node.type,
    nodeType: node.type,
    status: ExecutionStatus.SUCCESS,
    input: redactSecrets({ ...node.data, _previousOutput: context.lastOutput }),
    output: null,
    error: null,
    duration: 0,
    startedAt: new Date(stepStart),
    finishedAt: null,
    ...(metadata.iteration !== undefined ? { iteration: metadata.iteration } : {}),
    ...(metadata.loopNodeId ? { loopNodeId: metadata.loopNodeId } : {}),
  };

  try {
    if (typeof handler.validate === 'function') {
      const validation = handler.validate(node);
      if (validation && validation.valid === false) {
        throw new ValidationError(validation.error || `Validation failed for node "${loopStep.nodeName}"`);
      }
    }

    // Loop body executor invoked for each iteration
    const executeBody = async (iterationState) => {
      let lastIterationOutput = null;
      const iterationOutputs = { ...executedOutputs };
      const iterationSkipped = new Set(executionPath.skippedNodes);

      executionPath.emitEvent(ExecutionEvents.LOOP_ITERATION_STARTED, {
        nodeId: node.id,
        iteration: iterationState.index,
        item: iterationState.item,
      });

      for (const bodyNode of orderedLoopBody) {
        const canRun = BranchTraversal.isNodeExecutable(
          bodyNode,
          workflow.nodes,
          workflow.edges,
          iterationOutputs,
          iterationSkipped,
          context
        );

        if (!canRun) {
          iterationSkipped.add(bodyNode.id);
          continue;
        }

        let bodyOutput;
        if (bodyNode.type === NodeTypes.ACTION_LOOP) {
          // Recursive execution for nested loops
          bodyOutput = await executeLoopStep(
            bodyNode,
            context,
            executionPath,
            steps,
            workflow,
            iterationOutputs,
            handledLoopBodyNodes,
            {
              iteration: iterationState.index,
              loopNodeId: node.id,
              batch: iterationState.batchIndex,
            }
          );
        } else {
          bodyOutput = await executeNodeStep(bodyNode, context, executionPath, steps, workflow, {
            iteration: iterationState.index,
            loopNodeId: node.id,
            batch: iterationState.batchIndex,
          });
        }

        iterationOutputs[bodyNode.id] = bodyOutput;
        lastIterationOutput = bodyOutput;

        if (bodyOutput && (bodyOutput.break === true || bodyOutput.action === 'break')) {
          break;
        }
      }

      executionPath.emitEvent(ExecutionEvents.LOOP_ITERATION_COMPLETED, {
        nodeId: node.id,
        iteration: iterationState.index,
      });

      return lastIterationOutput !== null ? lastIterationOutput : iterationState.item;
    };

    const loopOutput = await handler.execute(node, context, { executeBody });
    loopStep.output = redactSecrets(loopOutput);
    executedOutputs[node.id] = loopOutput;
    context.setResult(node.id, loopOutput);

    executionPath.recordBranch(node.id, BranchTypes.DONE);
    executionPath.emitEvent(ExecutionEvents.LOOP_COMPLETED, {
      nodeId: node.id,
      iterations: loopOutput.iterations,
      total: loopOutput.total,
    });

    // Mark loop body nodes as handled so top-level pass does not re-run them
    loopBodySet.forEach((id) => handledLoopBodyNodes.add(id));

    loopStep.finishedAt = new Date();
    loopStep.duration = Date.now() - stepStart;
    steps.push(loopStep);

    return loopOutput;
  } catch (err) {
    loopStep.status = ExecutionStatus.FAILED;
    loopStep.error = err.message;
    loopStep.finishedAt = new Date();
    loopStep.duration = Date.now() - stepStart;
    steps.push(loopStep);

    logError(loopStep.nodeName, err, {
      workflowId: String(workflow._id),
      nodeId: node.id,
      nodeName: loopStep.nodeName,
      nodeType: node.type,
    });

    throw err;
  }
}

/**
 * Executes a complete workflow graph sequentially with branch-aware pruning and loop orchestration
 * @param {object} workflow - Mongoose Workflow document or workflow object
 * @param {string} ownerId - Owner user ID
 * @param {string} trigger - Execution trigger source ('manual' | 'schedule' | 'webhook')
 * @param {any} [triggerPayload] - Optional payload for webhook or scheduled execution
 * @returns {Promise<object>} - Execution Mongoose document
 */
async function run(workflow, ownerId, trigger = 'manual', triggerPayload = null) {
  const startedAt = Date.now();
  const steps = [];
  let executionStatus = ExecutionStatus.SUCCESS;
  let executionError = null;

  const triggerContext = new TriggerContext({
    triggerType: trigger,
    payload: triggerPayload,
    headers: triggerPayload?.headers || {},
    query: triggerPayload?.query || {},
  });

  const branchWarnings = validateConditionBranches(workflow.nodes, workflow.edges);
  if (branchWarnings.length > 0) {
    console.warn(`[WorkflowEngine] Branch Warnings for workflow ${workflow._id}:`, branchWarnings);
  }

  const orderedNodes = buildExecutionOrder(workflow.nodes, workflow.edges);
  const context = new ExecutionContext({
    workflowId: workflow._id,
    ownerId,
    trigger,
  });
  context.triggerPayload = triggerPayload;
  context.triggerContext = triggerContext;

  const executionPath = new ExecutionPath();
  const executedOutputs = {};
  const handledLoopBodyNodes = new Set();

  for (const node of orderedNodes) {
    // If node was already executed as part of an inner loop body, do not re-run in outer flow
    if (handledLoopBodyNodes.has(node.id)) {
      continue;
    }

    const stepStart = Date.now();
    const handler = registry.get(node.type);

    if (!handler) {
      console.warn(`No registered handler for node type: ${node.type}`);
      continue;
    }

    // Check branch reachability
    const canExecute = BranchTraversal.isNodeExecutable(
      node,
      workflow.nodes,
      workflow.edges,
      executedOutputs,
      executionPath.skippedNodes,
      context
    );

    if (!canExecute) {
      executionPath.recordSkipped(node.id);
      executionPath.emitEvent(ExecutionEvents.NODE_SKIPPED, { nodeId: node.id, nodeType: node.type });

      steps.push({
        nodeId: node.id,
        nodeName: node.data?.label || node.type,
        nodeType: node.type,
        status: ExecutionStatus.SKIPPED,
        input: { ...node.data, _previousOutput: context.lastOutput },
        output: { skippedReason: 'Branch not selected' },
        error: null,
        duration: 0,
        startedAt: new Date(stepStart),
        finishedAt: new Date(stepStart),
      });
      continue;
    }

    // Special orchestration for Loop Node (`action-loop`)
    if (node.type === NodeTypes.ACTION_LOOP) {
      try {
        await executeLoopStep(
          node,
          context,
          executionPath,
          steps,
          workflow,
          executedOutputs,
          handledLoopBodyNodes
        );
      } catch (err) {
        executionStatus = ExecutionStatus.FAILED;
        executionError = `Loop Node "${node.data?.label || node.id}" failed: ${err.message}`;
        break;
      }
      continue;
    }

    // Standard linear or condition node execution
    try {
      const output = await executeNodeStep(node, context, executionPath, steps, workflow);
      executedOutputs[node.id] = output;
    } catch (err) {
      executionStatus = ExecutionStatus.FAILED;
      executionError = `Node "${node.data?.label || node.type}" failed: ${err.message}`;
      break;
    }
  }

  const finishedAt = Date.now();

  const execution = await Execution.create({
    workflow: workflow._id,
    owner: ownerId,
    status: executionStatus,
    trigger,
    steps,
    startedAt: new Date(startedAt),
    finishedAt: new Date(finishedAt),
    duration: finishedAt - startedAt,
    error: executionError,
  });

  await Workflow.findByIdAndUpdate(workflow._id, {
    $inc: { runCount: 1 },
    lastRunAt: new Date(),
  });

  return execution;
}

module.exports = {
  run,
  buildExecutionOrder,
  findLoopBodyNodeIds,
  executeLoopStep,
  executeNodeStep,
};
