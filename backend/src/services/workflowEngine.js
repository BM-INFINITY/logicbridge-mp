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
} = require('../utils');
const { ExecutionStatus, NodeTypes, ExecutionEvents, BranchTypes } = require('../constants');
const { ValidationError, ExecutionPauseSignal } = require('../errors');
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

    const executionPath = new ExecutionPath();
    const executedOutputs = {};
    const handledLoopBodyNodes = new Set();

    let checkpointData = null;
    let approvalData = null;
    let waitData = null;

    try {
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
    });

    await Workflow.findByIdAndUpdate(workflow._id, {
      $inc: { runCount: 1 },
      lastRunAt: new Date(),
    });

    return execution;
  });
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

  // Authorization check for approval decisions
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

    const isOwner = userId && userId === ownerId;
    const isEmailAllowed = userEmail && allowed.some((a) => a.toLowerCase() === userEmail.toLowerCase());
    const isIdAllowed = userId && allowed.includes(userId);
    const isRoleAllowed = role && user?.role === role;
    const isUnrestricted = allowed.length === 0 && !role;

    if (!isOwner && !isEmailAllowed && !isIdAllowed && !isRoleAllowed && !isUnrestricted) {
      const authErr = new Error('Unauthorized to approve or reject this execution');
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

    try {
      for (const node of orderedNodes) {
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
      clearActiveSecrets();
    }

    const isStillPaused = executionStatus === ExecutionStatus.WAITING_APPROVAL || executionStatus === ExecutionStatus.PAUSED;

    execution.status = executionStatus;
    execution.steps = steps;
    if (!isStillPaused) {
      execution.finishedAt = new Date();
      execution.duration = execution.finishedAt.getTime() - execution.startedAt.getTime();
      execution.error = executionError;
      execution.checkpoint = null;
    } else {
      execution.checkpoint = newCheckpointData;
      if (newApprovalData) execution.approval = newApprovalData;
      if (newWaitData) execution.wait = newWaitData;
    }

    await execution.save();
    return execution;
  });
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
      const resumed = await resume(exec._id, { decision, comments: 'Auto-resolved via approval timeout' });
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
      const resumed = await resume(exec._id, {
        resumedBy: isTimeout ? 'timeout' : 'timer',
        payload: { expiredAt: now.toISOString() },
      });
      swept.push({ executionId: exec._id, type: 'wait', status: resumed.status });
    } catch (err) {
      console.warn(`[SweepTimeouts] Failed to resume wait for ${exec._id}:`, err.message);
    }
  }

  return swept;
}

module.exports = {
  run,
  resume,
  sweepTimeouts,
  buildExecutionOrder,
  findLoopBodyNodeIds,
  executeLoopStep,
  executeNodeStep,
};
