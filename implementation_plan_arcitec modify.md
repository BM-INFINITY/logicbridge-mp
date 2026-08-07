# Phase 1 Architecture Refactoring Plan

Refactor LogicBridge to implement Phase 1 Architecture Improvements cleanly and incrementally while ensuring complete backward compatibility, zero breaking changes to existing APIs/features, and full compilation at every task boundary.

## User Review Required

> [!IMPORTANT]
> - **Zero Stack Changes**: Express, React, Vite, Mongoose, Zustand, React Flow, and JWT authentication remain unchanged.
> - **Incremental Refactoring**: Each task is implemented, linked, and verified individually.
> - **Zero Feature Breakage**: All API routes, workflow engine logic, CSV exports, cron jobs, and AI generation remain 100% functional.

---

## Proposed Changes

### Backend Architecture Refactoring

#### 1. Constants Layer (`backend/src/constants/`)
Move magic strings into clean constants:
- `NodeTypes.js`: `TRIGGERS`, `ACTIONS`, `LOGIC` node identifiers.
- `ExecutionStatus.js`: `RUNNING`, `SUCCESS`, `FAILED`, `SKIPPED`.
- `WorkflowStatus.js`: `ACTIVE`, `INACTIVE`, `DRAFT`.
- `HttpMethods.js`: `GET`, `POST`, `PUT`, `DELETE`.

##### [NEW] [NodeTypes.js](file:///d:/logicbridge-mp/backend/src/constants/NodeTypes.js)
##### [NEW] [ExecutionStatus.js](file:///d:/logicbridge-mp/backend/src/constants/ExecutionStatus.js)
##### [NEW] [WorkflowStatus.js](file:///d:/logicbridge-mp/backend/src/constants/WorkflowStatus.js)
##### [NEW] [HttpMethods.js](file:///d:/logicbridge-mp/backend/src/constants/HttpMethods.js)

#### 2. Utility Layer (`backend/src/utils/`)
Extract reusable processing logic out of `workflowEngine.js`:
- `VariableResolver.js`: Resolves `{{ step_id.field }}` and `{{ prev.field }}` expressions.
- `CsvGenerator.js`: Auto-discovers nested array structures (`records`, `data`, `items`) and formats CSV content/files.
- `TemplateResolver.js`: Resolves JSON data transformation templates.
- `ExecutionLogger.js`: Standardizes console & execution timing logs.

##### [NEW] [VariableResolver.js](file:///d:/logicbridge-mp/backend/src/utils/VariableResolver.js)
##### [NEW] [CsvGenerator.js](file:///d:/logicbridge-mp/backend/src/utils/CsvGenerator.js)
##### [NEW] [TemplateResolver.js](file:///d:/logicbridge-mp/backend/src/utils/TemplateResolver.js)
##### [NEW] [ExecutionLogger.js](file:///d:/logicbridge-mp/backend/src/utils/ExecutionLogger.js)

#### 3. Modular Node Registry (`backend/src/nodes/`)
Replace monolithic `handlers` object with polymorphic node handler classes:
- `BaseNode.js`: Abstract base class specifying `execute(node, context)`, `validate(data)`, `metadata()`.
- Individual node classes for all 10 types: `ManualTriggerNode`, `ScheduleTriggerNode`, `WebhookTriggerNode`, `HttpNode`, `LogNode`, `DelayNode`, `TransformNode`, `ConditionNode`, `CsvNode`.
- `registry.js`: Dynamic map loading node instances by type identifier.

##### [NEW] [BaseNode.js](file:///d:/logicbridge-mp/backend/src/nodes/BaseNode.js)
##### [NEW] [ManualTriggerNode.js](file:///d:/logicbridge-mp/backend/src/nodes/ManualTriggerNode.js)
##### [NEW] [ScheduleTriggerNode.js](file:///d:/logicbridge-mp/backend/src/nodes/ScheduleTriggerNode.js)
##### [NEW] [WebhookTriggerNode.js](file:///d:/logicbridge-mp/backend/src/nodes/WebhookTriggerNode.js)
##### [NEW] [HttpNode.js](file:///d:/logicbridge-mp/backend/src/nodes/HttpNode.js)
##### [NEW] [LogNode.js](file:///d:/logicbridge-mp/backend/src/nodes/LogNode.js)
##### [NEW] [DelayNode.js](file:///d:/logicbridge-mp/backend/src/nodes/DelayNode.js)
##### [NEW] [TransformNode.js](file:///d:/logicbridge-mp/backend/src/nodes/TransformNode.js)
##### [NEW] [ConditionNode.js](file:///d:/logicbridge-mp/backend/src/nodes/ConditionNode.js)
##### [NEW] [CsvNode.js](file:///d:/logicbridge-mp/backend/src/nodes/CsvNode.js)
##### [NEW] [registry.js](file:///d:/logicbridge-mp/backend/src/nodes/registry.js)

#### 4. Workflow Engine Refactoring (`backend/src/services/workflowEngine.js`)
- Replace hardcoded `handlers` object with `registry.execute(node.type, node, context)`.
- Use `VariableResolver` and `ExecutionLogger`.
- Keep Kahn's topological sort execution order intact.

##### [MODIFY] [workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js)

#### 5. Controller Layer (`backend/src/controllers/`)
Extract HTTP request handling, payload validation, and status formatting out of route files:
- `authController.js`: Handles `register`, `login`, `getMe`.
- `workflowController.js`: Handles `getWorkflows`, `createWorkflow`, `getWorkflowById`, `updateWorkflow`, `deleteWorkflow`, `runWorkflow`, `generateWorkflow`.
- `executionController.js`: Handles `getExecutions`, `getWorkflowExecutions`, `getExecutionDetail`.
- Clean route files to only validate route parameters and delegate to controller methods.

##### [NEW] [authController.js](file:///d:/logicbridge-mp/backend/src/controllers/authController.js)
##### [NEW] [workflowController.js](file:///d:/logicbridge-mp/backend/src/controllers/workflowController.js)
##### [NEW] [executionController.js](file:///d:/logicbridge-mp/backend/src/controllers/executionController.js)
##### [MODIFY] [auth.js](file:///d:/logicbridge-mp/backend/src/routes/auth.js)
##### [MODIFY] [workflows.js](file:///d:/logicbridge-mp/backend/src/routes/workflows.js)
##### [MODIFY] [executions.js](file:///d:/logicbridge-mp/backend/src/routes/executions.js)

#### 6. Database Indexing (`backend/src/models/`)
Add compound indexes without modifying schema fields:
- `Workflow.js`: Index `{ owner: 1, updatedAt: -1 }`.
- `Execution.js`: Indexes `{ workflow: 1, startedAt: -1 }`, `{ owner: 1, startedAt: -1 }`.

##### [MODIFY] [Workflow.js](file:///d:/logicbridge-mp/backend/src/models/Workflow.js)
##### [MODIFY] [Execution.js](file:///d:/logicbridge-mp/backend/src/models/Execution.js)

---

### Frontend Architecture Refactoring

#### 7. Canvas Zustand Store (`frontend/src/store/canvasStore.js`)
Create a dedicated Zustand store for canvas state:
- Manages `nodes`, `edges`, `selectedNode`, `executionResult`, `workflowName`.
- Exposes actions: `setNodes`, `setEdges`, `onNodesChange`, `onEdgesChange`, `onConnect`, `addNode`, `updateNodeData`, `deleteNode`, `setSelectedNode`, `setWorkflowName`, `resetCanvas`.

##### [NEW] [canvasStore.js](file:///d:/logicbridge-mp/frontend/src/store/canvasStore.js)

#### 8. Decompose `BuilderPage.jsx` (`frontend/src/components/builder/`)
Extract layout components out of `BuilderPage.jsx`:
- `Toolbar.jsx`: Top navigation toolbar with workflow name, template button, AI button, save, run.
- `Canvas.jsx`: React Flow wrapper with controls, background, minimap, drag-and-drop handles.
- `NodePalette.jsx`: Left palette for dragging triggers, actions, logic nodes.
- `AIPanel.jsx`: Right popup for AI prompt entry.
- Simplify `BuilderPage.jsx` into a clean orchestrator component.

##### [NEW] [Toolbar.jsx](file:///d:/logicbridge-mp/frontend/src/components/builder/Toolbar.jsx)
##### [NEW] [Canvas.jsx](file:///d:/logicbridge-mp/frontend/src/components/builder/Canvas.jsx)
##### [NEW] [NodePalette.jsx](file:///d:/logicbridge-mp/frontend/src/components/builder/NodePalette.jsx)
##### [NEW] [AIPanel.jsx](file:///d:/logicbridge-mp/frontend/src/components/builder/AIPanel.jsx)
##### [MODIFY] [BuilderPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/BuilderPage.jsx)

#### 9. Decompose `StepEditorSidebar.jsx` (`frontend/src/components/sidebar/`)
Decompose the 600-line sidebar drawer into modular form tab components:
- `SidebarHeader.jsx`: Title, icon, delete button, close button.
- `HttpConfig.jsx`: URL, Method, Query parameters list, Headers list, Request body.
- `CsvConfig.jsx`: Column mappings, auto-detect button, delimiter, filename.
- `ConditionConfig.jsx`: Left value, operator, right value inputs.
- `TransformConfig.jsx`: JSON template input.
- `GeneralConfig.jsx`: Schedule cron inputs & log message inputs.
- `TestPanel.jsx`: Run step test button & JSON results preview.

##### [NEW] [SidebarHeader.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/SidebarHeader.jsx)
##### [NEW] [HttpConfig.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/HttpConfig.jsx)
##### [NEW] [CsvConfig.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/CsvConfig.jsx)
##### [NEW] [ConditionConfig.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/ConditionConfig.jsx)
##### [NEW] [TransformConfig.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/TransformConfig.jsx)
##### [NEW] [GeneralConfig.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/GeneralConfig.jsx)
##### [NEW] [TestPanel.jsx](file:///d:/logicbridge-mp/frontend/src/components/sidebar/TestPanel.jsx)
##### [MODIFY] [StepEditorSidebar.jsx](file:///d:/logicbridge-mp/frontend/src/components/StepEditorSidebar.jsx)

---

## Verification Plan

### Automated Verification
- Run `oxlint` on frontend: `cd frontend && npm run lint`
- Test frontend production build: `cd frontend && npm run build`
- Verify backend syntax for all created/modified JavaScript files: `node --check backend/src/...`

### Manual Verification
- Test User Login / Register flow.
- Test Canvas drag & drop, node configuration in StepEditorSidebar, template loading, and AI workflow generation.
- Test manual workflow execution (`POST /api/workflows/:id/run`) and verify step execution outputs and execution history logs.
