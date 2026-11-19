const Execution = require('../models/Execution');
const Workflow = require('../models/Workflow');
const WorkflowSecret = require('../models/WorkflowSecret');
const CredentialService = require('./CredentialService');
const { registry } = require('../nodes');
const {
  logError,
  ExecutionContext,
  ExecutionPath,
  TriggerContext,
  redactSecrets,
  registerActiveSecrets,
  clearActiveSecrets,
  runWithScope,
  generateWorkerId,
} = require('../utils');
const { ExecutionStatus, NodeTypes, ExecutionEvents, BranchTypes } = require('../constants');
const { ValidationError, ExecutionPauseSignal } = require('../errors');
const BranchTraversal = require('./BranchTraversal');
const { validateConditionBranches } = require('../validators/workflowValidator');
const AuditLogger = require('./AuditLogger');

const MAX_LOOP_DEPTH = 5;
const WORKER_ID = generateWorkerId('engine');
const LEASE_DURATION_MS = 60 * 1000; // 60 seconds execution lease

/**
 * Node types with potential external side effects (emails, messages, database writes, external HTTP)
 * which must NEVER be automatically replayed on crash recovery without manual operator verification.
 */
const EXTERNAL_SIDE_EFFECT_NODE_TYPES = new Set([
  'action-http',
  'action-email',
  'action-slack',
  'action-discord',
  'action-google-sheets',
  'action-postgres',
  'action-mongo',
  'action-file',
  'action-storage',
  'action-ai-generate',
  'action-ai-chat',
  'action-ai-agent',
  'action-ai-structured-output',
  'action-ai-classify',
  'action-ai-embeddings',
]);

function hasExternalSideEffects(nodeType) {
  if (!nodeType) return false;
  const normalized = String(nodeType).toLowerCase().trim();
  for (const t of EXTERNAL_SIDE_EFFECT_NODE_TYPES) {
    if (normalized.includes(t) || t.includes(normalized)) return true;
  }
  return false;
}

/**
 * Calculates byte size of a step output payload to enforce memory backpressure.
 * Safely handles circular references, BigInts, Buffers, and unsupported serialization values.
 */
function calculatePayloadSize(payload) {
  if (payload === null || payload === undefined) return 0;
  if (typeof payload === 'string') return Buffer.byteLength(payload, 'utf8');
  if (Buffer.isBuffer(payload)) return payload.length;
  if (typeof payload === 'number' || typeof payload === 'boolean') return 8;
  if (typeof payload === 'bigint') return 16;
  if (typeof payload === 'symbol' || typeof payload === 'function') return 0;

  try {
    const seen = new WeakSet();
    const str = JSON.stringify(payload, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });
    return str ? Buffer.byteLength(str, 'utf8') : 0;
  } catch (err) {
    throw new Error(`Failed to calculate step output size: serialization error (${err.message})`);
  }
}

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

    // Validate step output size against configured memory limit (REL-01)
    const maxStepOutputBytes = parseInt(process.env.MAX_STEP_OUTPUT_SIZE_BYTES, 10) || 5 * 1024 * 1024;
    const outputSizeBytes = calculatePayloadSize(output);
    if (outputSizeBytes > maxStepOutputBytes) {
      throw new Error(
        `Step output size (${(outputSizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit (${(maxStepOutputBytes / (1024 * 1024)).toFixed(2)}MB) in node "${step.nodeName}"`
      );
    }

    step.output = redactSecrets(output);
    context.setResult(node.id, output);

    if ((node.type === NodeTypes.LOGIC_CONDITION || node.type === NodeTypes.ACTION_CONDITION) && output?.selectedBranch) {
      executionPath.recordBranch(node.id, output.selectedBranch);
      executionPath.emitEvent(ExecutionEvents.CONDITION_EVALUATED, { nodeId: node.id, passed: output.passed });
      executionPath.emitEvent(ExecutionEvents.BRANCH_SELECTED, { nodeId: node.id, selectedBranch: output.selectedBranch });
    }

    if ((node.type === NodeTypes.ACTION_SWITCH || node.type === NodeTypes.LOGIC_SWITCH) && output?.selectedBranch) {
      executionPath.recordBranch(node.id, output.selectedBranch);
      executionPath.emitEvent(ExecutionEvents.SWITCH_EVALUATED, {
        nodeId: node.id,
        selectedBranch: output.selectedBranch,
        matchedCaseLabel: output.matchedCaseLabel,
        matched: output.matched,
      });
      executionPath.emitEvent(ExecutionEvents.BRANCH_SELECTED, { nodeId: node.id, selectedBranch: output.selectedBranch });
    }

    executionPath.emitEvent(ExecutionEvents.NODE_COMPLETED, { nodeId: node.id, nodeType: node.type, ...metadata });

    step.finishedAt = new Date();
    step.duration = Date.now() - stepStart;
    steps.push(step);

    return output;
  } catch (err) {
    if (err instanceof ExecutionPauseSignal) {
      throw err;
    }

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

      // Check duration timeout at the start of loop iteration (REL-01)
      const maxLoopDurationMs = parseInt(process.env.MAX_EXECUTION_DURATION_MS, 10) || 300000;
      if (context.startedAt && (Date.now() - context.startedAt > maxLoopDurationMs)) {
        throw new Error(
          `Workflow execution exceeded maximum duration limit of ${maxLoopDurationMs}ms inside loop "${node.data?.label || node.id}" (iteration ${iterationState.index})`
        );
      }

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

    // Validate aggregated loop output size against memory limit (REL-01)
    const maxStepOutputBytes = parseInt(process.env.MAX_STEP_OUTPUT_SIZE_BYTES, 10) || 5 * 1024 * 1024;
    const outputSizeBytes = calculatePayloadSize(loopOutput);
    if (outputSizeBytes > maxStepOutputBytes) {
      throw new Error(
        `Aggregated loop output size (${(outputSizeBytes / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit (${(maxStepOutputBytes / (1024 * 1024)).toFixed(2)}MB) in loop node "${loopStep.nodeName}"`
      );
    }

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

let activeExecutionsCount = 0;

function getActiveExecutionsCount() {
  return activeExecutionsCount;
}

async function waitForActiveExecutions(timeoutMs = 10000) {
  const startTime = Date.now();
  while (activeExecutionsCount > 0) {
    if (Date.now() - startTime >= timeoutMs) {
      console.warn(
        `[WorkflowEngine] Timeout (${timeoutMs}ms) reached waiting for ${activeExecutionsCount} active execution(s) to finish.`
      );
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
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
  // Deduplicate scheduled or event occurrences upfront across workers
  const occurrenceId = (triggerPayload && typeof triggerPayload === 'object' && triggerPayload.occurrenceId)
    ? String(triggerPayload.occurrenceId)
    : null;
  if (occurrenceId) {
    const existingOccurrence = await Execution.findOne({ occurrenceId });
    if (existingOccurrence) {
      console.warn(`[WorkflowEngine] Occurrence "${occurrenceId}" already executed. Skipping duplicate dispatch.`);
      return existingOccurrence;
    }
  }

  activeExecutionsCount++;
  try {
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

  // Load and type-cast workflow variables
  const variablesMap = {};
  if (Array.isArray(workflow.variables)) {
    for (const v of workflow.variables) {
      if (v && v.name) {
        let val = v.value;
        if (v.type === 'number') {
          val = Number(val);
        } else if (v.type === 'boolean') {
          val = val === true || val === 'true' || val === 1;
        } else if (v.type === 'json' && typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch {
            // Keep raw if invalid JSON
          }
        }
        variablesMap[v.name] = val;
      }
    }
  }

  // Fetch and decrypt workflow secrets
  const secretsMap = {};
  if (workflow._id && ownerId) {
    try {
      const secretDocs = await WorkflowSecret.find({ workflowId: workflow._id, ownerId });
      for (const s of secretDocs) {
        if (s && s.name && s.encryptedValue) {
          try {
            const dec = CredentialService.decrypt(s.encryptedValue);
            secretsMap[s.name] = dec;
          } catch (decErr) {
            console.warn(`[WorkflowEngine] Could not decrypt secret "${s.name}":`, decErr.message);
          }
        }
      }
    } catch (secErr) {
      console.warn(`[WorkflowEngine] Error querying secrets for workflow ${workflow._id}:`, secErr.message);
    }
  }

  return await runWithScope(secretsMap, async () => {
    registerActiveSecrets(secretsMap);

    const orderedNodes = buildExecutionOrder(workflow.nodes, workflow.edges);
    const context = new ExecutionContext({
      workflowId: workflow._id,
      ownerId,
      trigger,
      variables: variablesMap,
      secrets: secretsMap,
    });
    context.triggerPayload = triggerPayload;
    context.triggerContext = triggerContext;
    context.startedAt = startedAt;

    const executionPath = new ExecutionPath();
    const executedOutputs = {};
    const handledLoopBodyNodes = new Set();

    let checkpointData = null;
    let approvalData = null;
    let waitData = null;

    const maxExecutionDurationMs = parseInt(process.env.MAX_EXECUTION_DURATION_MS, 10) || 300000;

    try {
      for (const node of orderedNodes) {
        // Enforce maximum execution duration backpressure (REL-01)
        const elapsed = Date.now() - startedAt;
        if (elapsed > maxExecutionDurationMs) {
          executionStatus = ExecutionStatus.FAILED;
          executionError = `Workflow execution exceeded maximum duration limit of ${maxExecutionDurationMs}ms (elapsed: ${elapsed}ms)`;
          break;
        }

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

        // Standard linear, approval, wait, or condition node execution
        try {
          const output = await executeNodeStep(node, context, executionPath, steps, workflow);
          executedOutputs[node.id] = output;
        } catch (err) {
          if (err instanceof ExecutionPauseSignal) {
            const pauseStep = {
              nodeId: node.id,
              nodeName: node.data?.label || node.type,
              nodeType: node.type,
              status: err.pauseType === 'approval' ? 'waiting' : 'paused',
              input: redactSecrets({
                ...node.data,
                _previousOutput: context.lastOutput,
                _triggerContext: context.triggerContext,
              }),
              output: redactSecrets({
                pauseReason: err.pauseType,
                ...err.details,
                resumeToken: err.details?.resumeToken ? '[REDACTED]' : undefined,
              }),
              error: null,
              duration: Date.now() - stepStart,
              startedAt: new Date(stepStart),
              finishedAt: null,
            };
            steps.push(pauseStep);

            const isApproval = err.pauseType === 'approval';
            executionStatus = isApproval ? ExecutionStatus.WAITING_APPROVAL : ExecutionStatus.PAUSED;

            checkpointData = {
              currentNodeId: node.id,
              stepIndex: steps.length - 1,
              completedNodeIds: Object.keys(executedOutputs),
              executedOutputs: redactSecrets(executedOutputs),
              lastOutput: redactSecrets(context.lastOutput),
              variables: context.variables || {},
              skippedNodes: Array.from(executionPath.skippedNodes),
              loopStack: context.loopStack || [],
            };

            if (isApproval) {
              approvalData = {
                approvalId: err.details.approvalId,
                nodeId: node.id,
                title: err.details.title,
                description: err.details.description,
                message: err.details.message,
                allowedApprovers: err.details.allowedApprovers || [],
                approverRole: err.details.approverRole || null,
                status: 'pending',
                decision: null,
                decidedBy: null,
                decidedAt: null,
                comments: null,
                timeoutMinutes: err.details.timeoutMinutes,
                timeoutAt: err.details.timeoutMinutes ? new Date(Date.now() + err.details.timeoutMinutes * 60000) : null,
                timeoutAction: err.details.timeoutAction || 'reject',
              };
            } else {
              waitData = {
                waitId: err.details.waitId,
                nodeId: node.id,
                type: err.details.type,
                durationSeconds: err.details.durationSeconds || null,
                waitUntil: err.details.waitUntil || null,
                eventName: err.details.eventName || null,
                resumeToken: err.details.resumeToken || null,
                status: 'waiting',
                timeoutAt: err.details.timeoutAt || null,
                resumedAt: null,
                resumedBy: null,
                resumePayload: null,
              };
            }

            break;
          }

          executionStatus = ExecutionStatus.FAILED;
          executionError = `Node "${node.data?.label || node.type}" failed: ${err.message}`;
          break;
        }
      }
    } finally {
      clearActiveSecrets();
    }

    const finishedAt = Date.now();
    const isPaused = executionStatus === ExecutionStatus.WAITING_APPROVAL || executionStatus === ExecutionStatus.PAUSED;

    const execution = await Execution.create({
      workflow: workflow._id,
      owner: ownerId,
      status: executionStatus,
      trigger,
      steps,
      startedAt: new Date(startedAt),
      finishedAt: isPaused ? null : new Date(finishedAt),
      duration: isPaused ? 0 : finishedAt - startedAt,
      error: executionError,
      checkpoint: checkpointData,
      approval: approvalData,
      wait: waitData,
      occurrenceId: (triggerPayload && typeof triggerPayload === 'object' && triggerPayload.occurrenceId) ? String(triggerPayload.occurrenceId) : null,
    });

    await Workflow.findByIdAndUpdate(workflow._id, {
      $inc: { runCount: 1 },
      lastRunAt: new Date(),
    });

    return execution;
  });
  } finally {
    activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
  }
}

/**
 * Resumes a paused execution (waiting for human approval, duration delay, or external event)
 * Restores state from checkpoint, evaluates dynamic branches, and continues downstream execution.
 *
 * @param {string} executionId - Execution Mongo ID
 * @param {object} resumeOptions - Options: { decision, comments, resumedBy, payload }
 * @param {object} [user] - Calling user object for permission validation
 * @returns {Promise<object>} Resumed Execution record
 */
async function resume(executionId, resumeOptions = {}, user = null) {
  // 1. Fetch and validate execution state BEFORE claiming
  const execution = await Execution.findById(executionId);
  if (!execution) {
    throw new ValidationError(`Execution ${executionId} not found`);
  }

  if (
    execution.status !== ExecutionStatus.WAITING_APPROVAL &&
    execution.status !== ExecutionStatus.PAUSED
  ) {
    throw new ValidationError(
      `Execution ${executionId} is in status "${execution.status}" and cannot be resumed (must be "waiting_approval" or "paused")`
    );
  }

  const workflow = await Workflow.findById(execution.workflow);
  if (!workflow) {
    throw new ValidationError(`Workflow for execution ${executionId} not found`);
  }

  const isApproval = execution.status === ExecutionStatus.WAITING_APPROVAL;
  const isWait = execution.status === ExecutionStatus.PAUSED;

  activeExecutionsCount++;
  try {

  // 2. Pre-claim authorization and parameter validation for approvals
  if (isApproval) {
    let { decision, comments } = resumeOptions;
    if (decision === 'approve') decision = 'approved';
    if (decision === 'reject') decision = 'rejected';
    if (!['approved', 'rejected'].includes(decision)) {
      throw new ValidationError('Approval decision must be either "approved" or "rejected"');
    }
    resumeOptions.decision = decision;

    const allowed = execution.approval?.allowedApprovers || [];
    const role = execution.approval?.approverRole;
    const userEmail = user?.email;
    const userId = user?._id ? String(user._id) : null;
    const ownerId = String(execution.owner);
    const userRole = user?.role || 'user';
    const isAdmin = userRole === 'admin';

    const isEmailAllowed = userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase());
    const isIdAllowed = userId && allowed.includes(userId);
    const isRoleAllowed = role && (userRole === role || isAdmin);
    const isOwner = userId && userId === ownerId;

    let isAuthorized = false;
    if (isAdmin) {
      isAuthorized = true;
    } else if (role && allowed.length > 0) {
      isAuthorized = isRoleAllowed || isEmailAllowed || isIdAllowed;
    } else if (role) {
      // Role explicitly required — owner cannot approve unless they hold the role or are admin
      isAuthorized = isRoleAllowed;
    } else if (allowed.length > 0) {
      // Specific approvers explicitly required
      isAuthorized = isEmailAllowed || isIdAllowed;
    } else {
      // Unrestricted: workflow owner or admin
      isAuthorized = isOwner;
    }

    // Reject unauthorized attempts IMMEDIATELY without claiming or modifying DB status
    if (!isAuthorized) {
      AuditLogger.recordEvent({
        eventType: AuditLogger.AuditEvents.AUTHORIZATION_FAILURE,
        severity: 'warn',
        actorId: userId,
        actorEmail: userEmail,
        actorRole: userRole,
        targetResource: `execution:${executionId}:approval`,
        outcome: 'blocked',
        details: { reason: 'insufficient role or not in approvers list', approverRole: role },
      });

      const authErr = new Error('Unauthorized to approve or reject this execution: insufficient role or not in approvers list');
      authErr.statusCode = 403;
      throw authErr;
    }

    // Check timeout
    let finalStatus = decision;
    if (execution.approval?.timeoutAt && new Date() > new Date(execution.approval.timeoutAt)) {
      finalStatus = 'timeout';
      resumeOptions.decision = execution.approval.timeoutAction || 'reject';
    }

    execution.approval.status = finalStatus;
    execution.approval.decision = resumeOptions.decision;
    execution.approval.decidedBy = userEmail || userId || 'system';
    execution.approval.decidedAt = new Date();
    execution.approval.comments = comments || '';
  }

  // 3. Atomically claim execution only after authorization check passes
  const claim = await Execution.findOneAndUpdate(
    {
      _id: executionId,
      status: execution.status,
    },
    {
      $set: {
        status: ExecutionStatus.RUNNING,
        workerId: WORKER_ID,
        heartbeatAt: new Date(),
        leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS),
        'wait.resumeToken': null, // Single-use token immediately invalidated on claim
      },
    },
    { new: true }
  );

  if (!claim) {
    const current = await Execution.findById(executionId);
    throw new ValidationError(
      `Execution ${executionId} is in status "${current?.status || 'unknown'}" and cannot be resumed (must be "waiting_approval" or "paused")`
    );
  }

  if (isWait) {
    let isTimeout = false;
    if (execution.wait?.timeoutAt && new Date() > new Date(execution.wait.timeoutAt)) {
      isTimeout = true;
    }

    execution.wait.status = isTimeout ? 'timeout' : 'resumed';
    execution.wait.resumedAt = new Date();
    execution.wait.resumedBy = user?.email || resumeOptions.resumedBy || 'system';
    execution.wait.resumePayload = resumeOptions.payload || {};
  }

  // Fetch and decrypt secrets securely for this workflow
  const secretsMap = {};
  if (workflow._id && execution.owner) {
    try {
      const secretDocs = await WorkflowSecret.find({ workflowId: workflow._id, ownerId: execution.owner });
      for (const s of secretDocs) {
        if (s && s.name && s.encryptedValue) {
          try {
            secretsMap[s.name] = CredentialService.decrypt(s.encryptedValue);
          } catch (decErr) {
            console.warn(`[WorkflowEngine] Could not decrypt secret "${s.name}":`, decErr.message);
          }
        }
      }
    } catch (secErr) {
      console.warn(`[WorkflowEngine] Error querying secrets:`, secErr.message);
    }
  }

  return await runWithScope(secretsMap, async () => {
    registerActiveSecrets(secretsMap);

    const checkpoint = execution.checkpoint || {};
    const context = new ExecutionContext({
      workflowId: workflow._id,
      ownerId: execution.owner,
      trigger: execution.trigger,
      variables: checkpoint.variables || {},
      secrets: secretsMap,
    });
    context.lastOutput = checkpoint.lastOutput || null;
    if (checkpoint.executedOutputs) {
      for (const [k, v] of Object.entries(checkpoint.executedOutputs)) {
        context.setResult(k, v);
      }
    }

    if (isApproval) {
      context.resumingApproval = {
        approvalId: execution.approval.approvalId,
        nodeId: execution.approval.nodeId,
        status: execution.approval.status,
        decision: execution.approval.decision,
        decidedBy: execution.approval.decidedBy,
        decidedAt: execution.approval.decidedAt,
        comments: execution.approval.comments,
      };
    }

    if (isWait) {
      context.resumingWait = {
        waitId: execution.wait.waitId,
        nodeId: execution.wait.nodeId,
        status: execution.wait.status,
        resumedAt: execution.wait.resumedAt,
        resumedBy: execution.wait.resumedBy,
        resumePayload: execution.wait.resumePayload,
      };
      // Enforce single-use token: invalidate resumeToken immediately upon resumption
      execution.wait.resumeToken = null;
    }

    const executionPath = new ExecutionPath();
    if (Array.isArray(checkpoint.skippedNodes)) {
      checkpoint.skippedNodes.forEach((id) => executionPath.recordSkipped(id));
    }

    const executedOutputs = { ...(checkpoint.executedOutputs || {}) };
    const handledLoopBodyNodes = new Set();
    const orderedNodes = buildExecutionOrder(workflow.nodes, workflow.edges);
    const steps = execution.steps || [];

    const resumeNodeId = checkpoint.currentNodeId;
    let resumeStarted = false;
    let executionStatus = ExecutionStatus.SUCCESS;
    let executionError = null;

    let newCheckpointData = null;
    let newApprovalData = null;
    let newWaitData = null;
    let ownershipLost = false;

    const resumeHeartbeatTimer = setInterval(async () => {
      try {
        const renewRes = await Execution.updateOne(
          { _id: executionId, workerId: WORKER_ID },
          { $set: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS) } }
        );
        if (renewRes.matchedCount === 0) {
          ownershipLost = true;
          console.warn(`[WorkflowEngine] Resume heartbeat lock lost for execution ${executionId} (worker ${WORKER_ID}).`);
          clearInterval(resumeHeartbeatTimer);
        }
      } catch (hbErr) {
        console.warn(`[WorkflowEngine] Resume heartbeat warning for ${executionId}:`, hbErr.message);
      }
    }, Math.min(LEASE_DURATION_MS / 2, 20000));

    const resumeStartedAt = Date.now();
    context.startedAt = resumeStartedAt;
    const maxResumeDurationMs = parseInt(process.env.MAX_EXECUTION_DURATION_MS, 10) || 300000;

    try {
      for (const node of orderedNodes) {
        if (ownershipLost) {
          throw new Error(`Execution ${executionId} aborted: worker lease was lost or claimed by another worker.`);
        }

        // Enforce maximum execution duration backpressure during resume (REL-01)
        const elapsed = Date.now() - resumeStartedAt;
        if (elapsed > maxResumeDurationMs) {
          executionStatus = ExecutionStatus.FAILED;
          executionError = `Workflow execution exceeded maximum duration limit of ${maxResumeDurationMs}ms during resume (elapsed: ${elapsed}ms)`;
          break;
        }

        if (!resumeStarted) {
          if (node.id === resumeNodeId) {
            resumeStarted = true;
          } else {
            continue;
          }
        }

        if (handledLoopBodyNodes.has(node.id)) {
          continue;
        }

        const stepStart = Date.now();
        const handler = registry.get(node.type);
        if (!handler) {
          console.warn(`No registered handler for node type: ${node.type}`);
          continue;
        }

        // For the resume node itself: update the waiting step in-place
        if (node.id === resumeNodeId) {
          const stepIndex = checkpoint.stepIndex ?? steps.findIndex((s) => s.nodeId === node.id);
          try {
            const output = await handler.execute(node, context);
            executedOutputs[node.id] = output;
            context.setResult(node.id, output);
            context.lastOutput = output;

            if (stepIndex >= 0 && steps[stepIndex]) {
              steps[stepIndex].status = ExecutionStatus.SUCCESS;
              steps[stepIndex].output = redactSecrets(output);
              steps[stepIndex].finishedAt = new Date();
              steps[stepIndex].duration = Date.now() - new Date(steps[stepIndex].startedAt).getTime();
            }
          } catch (err) {
            executionStatus = ExecutionStatus.FAILED;
            executionError = `Resumed node "${node.data?.label || node.type}" failed: ${err.message}`;
            if (stepIndex >= 0 && steps[stepIndex]) {
              steps[stepIndex].status = ExecutionStatus.FAILED;
              steps[stepIndex].error = err.message;
              steps[stepIndex].finishedAt = new Date();
            }
            break;
          }
          continue;
        }

        // For subsequent nodes: check branch reachability
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

        if (node.type === NodeTypes.ACTION_LOOP) {
          try {
            await executeLoopStep(node, context, executionPath, steps, workflow, executedOutputs, handledLoopBodyNodes);
          } catch (err) {
            executionStatus = ExecutionStatus.FAILED;
            executionError = `Loop Node "${node.data?.label || node.id}" failed: ${err.message}`;
            break;
          }
          continue;
        }

        try {
          const output = await executeNodeStep(node, context, executionPath, steps, workflow);
          executedOutputs[node.id] = output;
        } catch (err) {
          if (err instanceof ExecutionPauseSignal) {
            const pauseStep = {
              nodeId: node.id,
              nodeName: node.data?.label || node.type,
              nodeType: node.type,
              status: err.pauseType === 'approval' ? 'waiting' : 'paused',
              input: redactSecrets({
                ...node.data,
                _previousOutput: context.lastOutput,
              }),
              output: redactSecrets({
                pauseReason: err.pauseType,
                ...err.details,
                resumeToken: err.details?.resumeToken ? '[REDACTED]' : undefined,
              }),
              error: null,
              duration: Date.now() - stepStart,
              startedAt: new Date(stepStart),
              finishedAt: null,
            };
            steps.push(pauseStep);

            const isNewAppr = err.pauseType === 'approval';
            executionStatus = isNewAppr ? ExecutionStatus.WAITING_APPROVAL : ExecutionStatus.PAUSED;

            newCheckpointData = {
              currentNodeId: node.id,
              stepIndex: steps.length - 1,
              completedNodeIds: Object.keys(executedOutputs),
              executedOutputs: redactSecrets(executedOutputs),
              lastOutput: redactSecrets(context.lastOutput),
              variables: context.variables || {},
              skippedNodes: Array.from(executionPath.skippedNodes),
              loopStack: context.loopStack || [],
            };

            if (isNewAppr) {
              newApprovalData = {
                approvalId: err.details.approvalId,
                nodeId: node.id,
                title: err.details.title,
                description: err.details.description,
                message: err.details.message,
                allowedApprovers: err.details.allowedApprovers || [],
                approverRole: err.details.approverRole || null,
                status: 'pending',
                timeoutMinutes: err.details.timeoutMinutes,
                timeoutAt: err.details.timeoutMinutes ? new Date(Date.now() + err.details.timeoutMinutes * 60000) : null,
                timeoutAction: err.details.timeoutAction || 'reject',
              };
            } else {
              newWaitData = {
                waitId: err.details.waitId,
                nodeId: node.id,
                type: err.details.type,
                durationSeconds: err.details.durationSeconds || null,
                waitUntil: err.details.waitUntil || null,
                eventName: err.details.eventName || null,
                resumeToken: err.details.resumeToken || null,
                status: 'waiting',
                timeoutAt: err.details.timeoutAt || null,
              };
            }
            break;
          }

          executionStatus = ExecutionStatus.FAILED;
          executionError = `Node "${node.data?.label || node.type}" failed: ${err.message}`;
          break;
        }
      }
    } finally {
      if (resumeHeartbeatTimer) clearInterval(resumeHeartbeatTimer);
      clearActiveSecrets();
    }

    if (ownershipLost) {
      console.warn(`[WorkflowEngine] Fencing: Worker ${WORKER_ID} lost lease for execution ${executionId}; aborting authoritative state save.`);
      return execution;
    }

    const isStillPaused = executionStatus === ExecutionStatus.WAITING_APPROVAL || executionStatus === ExecutionStatus.PAUSED;

    const updateFields = {
      status: executionStatus,
      steps,
      workerId: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      checkpoint: isStillPaused ? newCheckpointData : null,
    };
    if (!isStillPaused) {
      updateFields.finishedAt = new Date();
      updateFields.duration = updateFields.finishedAt.getTime() - execution.startedAt.getTime();
      updateFields.error = executionError;
    } else {
      if (newApprovalData) updateFields.approval = newApprovalData;
      if (newWaitData) updateFields.wait = newWaitData;
    }

    const saveRes = await Execution.updateOne(
      { _id: executionId, workerId: WORKER_ID },
      { $set: updateFields }
    );

    if (saveRes.matchedCount === 0) {
      console.warn(`[WorkflowEngine] Fencing: Worker ${WORKER_ID} could not save execution ${executionId} because ownership was lost to another worker.`);
    }

    Object.assign(execution, updateFields);
    return execution;
  });
  } finally {
    activeExecutionsCount = Math.max(0, activeExecutionsCount - 1);
  }
}

/**
 * Sweeps and auto-resolves expired approvals or waits whose timer/waitUntil has passed
 * @returns {Promise<Array>} List of auto-resumed executions
 */
async function sweepTimeouts() {
  const now = new Date();
  const swept = [];

  // 1. Expired approvals
  const expiredApprovals = await Execution.find({
    status: ExecutionStatus.WAITING_APPROVAL,
    'approval.timeoutAt': { $lte: now },
    'approval.status': 'pending',
  });

  for (const exec of expiredApprovals) {
    try {
      const decision = exec.approval?.timeoutAction || 'reject';
      const resumed = await resume(
        exec._id,
        { decision, comments: 'Auto-resolved via approval timeout' },
        { role: 'admin', email: 'system' }
      );
      swept.push({ executionId: exec._id, type: 'approval', status: resumed.status });
    } catch (err) {
      console.warn(`[SweepTimeouts] Failed to auto-resolve approval for ${exec._id}:`, err.message);
    }
  }

  // 2. Expired wait duration/date or event timeout
  const expiredWaits = await Execution.find({
    status: ExecutionStatus.PAUSED,
    'wait.status': 'waiting',
    $or: [
      { 'wait.type': { $in: ['duration', 'date'] }, 'wait.waitUntil': { $lte: now } },
      { 'wait.type': 'event', 'wait.timeoutAt': { $lte: now } },
    ],
  });

  for (const exec of expiredWaits) {
    try {
      const isTimeout = exec.wait?.type === 'event';
      const resumed = await resume(
        exec._id,
        {
          resumedBy: isTimeout ? 'timeout' : 'timer',
          payload: { expiredAt: now.toISOString() },
        },
        { role: 'admin', email: 'system' }
      );
      swept.push({ executionId: exec._id, type: 'wait', status: resumed.status });
    } catch (err) {
      console.warn(`[SweepTimeouts] Failed to resume wait for ${exec._id}:`, err.message);
    }
  }

  return swept;
}

/**
 * Recovers interrupted executions after a server restart or crash.
 * Uses atomic findOneAndUpdate claiming to avoid race conditions across instances,
 * checks for potential external side-effects before permitting safe resumption,
 * and attaches structured diagnostic metadata.
 *
 * @param {object|number} [options={}] - Options or stale threshold in milliseconds
 * @returns {Promise<number>} Count of recovered executions
 */
async function recoverInterruptedExecutions(options = {}) {
  const staleThresholdMs = typeof options === 'number'
    ? options
    : (options?.staleThresholdMs ?? (parseInt(process.env.STALE_EXECUTION_THRESHOLD_MS, 10) || 15 * 60 * 1000));
  const now = new Date();
  const cutoff = new Date(now.getTime() - staleThresholdMs);

  const filter = {
    status: ExecutionStatus.RUNNING,
    $or: [
      { leaseExpiresAt: { $lt: now } },
      {
        leaseExpiresAt: null,
        $or: [
          { startedAt: { $lte: cutoff } },
          { startedAt: null },
          { createdAt: { $lte: cutoff } },
        ],
      },
    ],
  };

  const candidates = await Execution.find(filter, { _id: 1, steps: 1, startedAt: 1 }).lean();
  if (candidates.length === 0) return 0;

  let recoveredCount = 0;

  for (const candidate of candidates) {
    // Atomically claim the execution for recovery so only ONE worker instance processes it
    const exec = await Execution.findOne({
      _id: candidate._id,
      status: ExecutionStatus.RUNNING,
    });
    if (!exec) continue;

    // Check steps for external side effects
    const steps = Array.isArray(exec.steps) ? exec.steps : [];
    let hasSideEffects = false;
    let uncertainStatus = false;
    let lastStep = null;

    if (steps.length > 0) {
      lastStep = steps[steps.length - 1];
      for (const step of steps) {
        if (step && (step.status === 'running' || step.status === 'success' || step.status === 'waiting' || !step.status)) {
          if (hasExternalSideEffects(step.nodeType)) {
            hasSideEffects = true;
            break;
          }
        }
      }
    }

    // Inspect workflow definition to check if the next in-flight/unrecorded node had external side effects
    if (!hasSideEffects && exec.workflow) {
      try {
        const wf = await Workflow.findById(exec.workflow).lean();
        if (wf && Array.isArray(wf.nodes)) {
          const completedNodeIds = new Set(
            steps.filter((s) => s.status === 'success').map((s) => s.nodeId)
          );
          const pendingNodes = wf.nodes.filter((n) => !completedNodeIds.has(n.id));
          for (const pendingNode of pendingNodes) {
            if (hasExternalSideEffects(pendingNode.type)) {
              hasSideEffects = true;
              uncertainStatus = true;
              break;
            }
          }
        } else if (!wf) {
          // If workflow cannot be loaded, side-effect status cannot be verified -> conservative manual review required
          hasSideEffects = true;
          uncertainStatus = true;
        }
      } catch {
        hasSideEffects = true;
        uncertainStatus = true;
      }
    }

    const finishedAt = new Date();
    const duration = exec.startedAt ? finishedAt.getTime() - new Date(exec.startedAt).getTime() : 0;

    // Update in-progress steps
    const updatedSteps = steps.map((s) => {
      const stepObj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      if (!stepObj.status || stepObj.status === 'running' || stepObj.status === 'waiting') {
        stepObj.status = 'failed';
        stepObj.error = 'Execution interrupted by process termination or server restart';
        stepObj.finishedAt = finishedAt;
        if (stepObj.startedAt) {
          stepObj.duration = finishedAt.getTime() - new Date(stepObj.startedAt).getTime();
        }
      }
      return stepObj;
    });

    const recoveryMetadata = {
      recoveredAt: finishedAt,
      recoveredBy: WORKER_ID,
      reason: hasSideEffects
        ? (uncertainStatus ? 'UNCERTAIN_EXTERNAL_SIDE_EFFECTS_OR_CRASH' : 'POTENTIAL_DUPLICATE_EXTERNAL_SIDE_EFFECTS')
        : 'PROCESS_CRASH_OR_LEASE_EXPIRED',
      safeToAutoResume: !hasSideEffects,
      lastExecutedNodeType: lastStep?.nodeType || null,
      lastExecutedNodeId: lastStep?.nodeId || null,
      requiresManualIntervention: hasSideEffects,
    };

    const errorMessage = hasSideEffects
      ? (uncertainStatus
          ? 'Execution interrupted with in-flight or uncertain external operations. Automatic replay blocked to prevent duplicate real-world actions; manual operator review required.'
          : 'Execution interrupted during external side-effect operations. Automatic replay blocked to prevent duplicate actions; manual review required.')
      : 'Execution interrupted by process termination or server restart';

    // Atomically transition status from RUNNING to FAILED with recovery metadata
    const result = await Execution.findOneAndUpdate(
      {
        _id: candidate._id,
        status: ExecutionStatus.RUNNING,
      },
      {
        $set: {
          status: ExecutionStatus.FAILED,
          error: errorMessage,
          finishedAt,
          duration,
          workerId: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          steps: updatedSteps,
          recovery: recoveryMetadata,
        },
      },
      { new: true }
    );

    if (result) {
      recoveredCount++;
    }
  }

  if (recoveredCount > 0) {
    console.log(`[WorkflowEngine] Atomically recovered ${recoveredCount} interrupted execution(s) after restart.`);
  }
  return recoveredCount;
}

module.exports = {
  run,
  resume,
  sweepTimeouts,
  recoverInterruptedExecutions,
  buildExecutionOrder,
  findLoopBodyNodeIds,
  executeLoopStep,
  executeNodeStep,
  getActiveExecutionsCount,
  waitForActiveExecutions,
  hasExternalSideEffects,
  EXTERNAL_SIDE_EFFECT_NODE_TYPES,
  calculatePayloadSize,
};
