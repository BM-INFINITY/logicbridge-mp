const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const { registry } = require('../nodes');
const { logError, ExecutionContext } = require('../utils');
const { ExecutionStatus } = require('../constants');
const { ValidationError, NodeExecutionError } = require('../errors');

/**
 * Topological Sort via edges (Kahn's Algorithm with x-position fallback)
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @returns {Array} - Execution order array of nodes
 */
function buildExecutionOrder(nodes, edges) {
  if (!edges || edges.length === 0) {
    // Fallback: sort by x position
    return [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
  }

  const inDegree = {};
  const adjacency = {};
  nodes.forEach((n) => { inDegree[n.id] = 0; adjacency[n.id] = []; });
  edges.forEach((e) => {
    adjacency[e.source] = adjacency[e.source] || [];
    adjacency[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0);
  const order = [];

  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    (adjacency[node.id] || []).forEach((targetId) => {
      inDegree[targetId]--;
      if (inDegree[targetId] === 0) {
        const targetNode = nodes.find((n) => n.id === targetId);
        if (targetNode) queue.push(targetNode);
      }
    });
  }

  return order.length === nodes.length ? order : [...nodes].sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0));
}

/**
 * Executes a complete workflow graph sequentially
 * @param {object} workflow - Mongoose Workflow document or workflow object
 * @param {string} ownerId - Owner user ID
 * @param {string} trigger - Execution trigger type ('manual' | 'schedule' | 'webhook')
 * @returns {Promise<object>} - Execution Mongoose document
 */
async function run(workflow, ownerId, trigger = 'manual') {
  const startedAt = Date.now();
  const steps = [];
  let executionStatus = ExecutionStatus.SUCCESS;
  let executionError = null;

  const orderedNodes = buildExecutionOrder(workflow.nodes, workflow.edges);
  const context = new ExecutionContext({
    workflowId: workflow._id,
    ownerId,
    trigger,
  });

  for (const node of orderedNodes) {
    const stepStart = Date.now();
    const handler = registry.get(node.type);

    if (!handler) {
      console.warn(`No registered handler for node type: ${node.type}`);
      continue;
    }

    const step = {
      nodeId: node.id,
      nodeName: node.data?.label || node.type,
      nodeType: node.type,
      status: ExecutionStatus.SUCCESS,
      input: { ...node.data, _previousOutput: context.lastOutput },
      output: null,
      error: null,
      duration: 0,
    };

    try {
      if (typeof handler.validate === 'function') {
        const validation = handler.validate(node);
        if (validation && validation.valid === false) {
          throw new ValidationError(validation.error || `Validation failed for node "${step.nodeName}"`);
        }
      }

      const output = await handler.execute(node, context);
      step.output = output;
      context.setResult(node.id, output);
    } catch (err) {
      step.status = ExecutionStatus.FAILED;
      step.error = err.message;
      executionStatus = ExecutionStatus.FAILED;
      executionError = `Node "${step.nodeName}" failed: ${err.message}`;
      step.duration = Date.now() - stepStart;
      steps.push(step);

      logError(step.nodeName, err, {
        workflowId: String(workflow._id),
        nodeId: node.id,
        nodeName: step.nodeName,
        nodeType: node.type,
      });
      break;
    }

    step.duration = Date.now() - stepStart;
    steps.push(step);
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

module.exports = { run };
