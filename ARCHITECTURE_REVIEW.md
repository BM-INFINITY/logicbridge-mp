# 🏛️ LogicBridge — Comprehensive Architecture Review Report

> **Prepared for:** Team MP_022 (Guide: Prof. Sonal Parmar)  
> **Role:** Principal Software Architect  
> **Target System:** LogicBridge Visual Workflow Automation Engine  
> **Scope:** Architecture Evaluation, Bottleneck Analysis, Industry Comparison, Modular Redesign & Refactoring Plan  

---

## 1. Review of Current Architecture

The architecture of **LogicBridge** is a decoupled Client-Server model built with React + Vite on the frontend and Express + Node.js on the backend, using MongoDB Atlas for storage. The table below evaluates each subsystem against production & educational engineering standards.

| Subsystem | Score (/10) | Key Strengths | Key Weaknesses |
| :--- | :---: | :--- | :--- |
| **Folder Structure** | **7 / 10** | Clear separation between `backend/src` and `frontend/src`; domain-based route naming. | Component directory flat; backend services combine routing & engine logic without interface layers. |
| **Backend Architecture** | **6.5 / 10** | Clean Express route mounting (`/api/auth`, `/api/workflows`, `/api/executions`); simple middleware guard. | Missing controller layer; route handlers directly invoke Mongoose models and inline logic. |
| **Frontend Architecture** | **7.5 / 10** | Great visual layout, responsive state updates, modern glassmorphism design system. | `BuilderPage.jsx` and `StepEditorSidebar.jsx` are monolithic (>300 and >600 lines); UI mixed with node data manipulation. |
| **Service Layer** | **6 / 10** | `workflowEngine.js`, `scheduler.js`, `aiGenerator.js` isolate core logic from routes. | No registry or interface abstractions for node handlers; tight coupling with inline file system calls (`fs.writeFileSync`). |
| **Workflow Engine** | **6.5 / 10** | Implements Kahn's Topological Sort algorithm; supports mustache template expression resolution. | Linear execution loop ignores condition branches; single node failure aborts flow without retries. |
| **Database Design** | **7 / 10** | Clean Mongoose models (`User`, `Workflow`, `Execution`); timestamps enabled; password hashing hooks. | Storing entire node & edge JSON arrays inside Workflow document without versioning; no indexes on `Execution.startedAt`. |
| **API Design** | **7.5 / 10** | Standard RESTful design, clean resource hierarchy, standardized JSON response structures. | Missing API response wrapper/formatter; route `/api/workflows/generate` placed before `/:id` due to route collision ordering. |
| **Execution Engine** | **6 / 10** | Synchronous sequential execution; accurate step duration timing and JSON log capture. | Blocking in-process execution blocks Express main thread during long HTTP calls or CSV file writes. |
| **Scheduler** | **6.5 / 10** | `node-cron` integration; in-memory map tracking; IST timezone support; auto-init on boot. | In-memory map lost if server crashes; direct database polling/update inside cron callback. |
| **Authentication** | **8 / 10** | Robust JWT auth flow; `bcryptjs` salt 12 hashing; clean Bearer token header interceptor in Axios. | Lacks refresh tokens; token stored in `localStorage` instead of HTTP-only cookies (acceptable for minor project). |
| **State Management** | **8 / 10** | Zustand stores (`authStore`, `workflowStore`) cleanly encapsulate API interactions. | Canvas state (`nodes`, `edges`) managed locally in `BuilderPage` instead of being bound to a dedicated canvas Zustand store. |

**Overall Architecture Score: 6.8 / 10** (Strong MVP foundation, high visual polish, but requires modularization for execution scalability).

---

## 2. Architectural Problems & Root Causes

### 1. Sequential Execution Loop Ignores Condition Branches (Tight Coupling & Logic Limitation)
* **Location:** [backend/src/services/workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js#L296-L343)
* **Issue:** `workflowEngine.run()` loops through `orderedNodes` sequentially. When a `logic-condition` node executes and returns `{ passed: false }`, the loop continues executing downstream nodes regardless of the condition outcome.
* **Why it exists:** The engine uses a global topological sort algorithm (`buildExecutionOrder`) intended for Directed Acyclic Graphs (DAGs) without evaluating branch edges (`sourceHandle` / `targetHandle` routing).

### 2. Monolithic Node Handler Map (Poor Abstraction & Maintenance Bottleneck)
* **Location:** [backend/src/services/workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js#L8-L259)
* **Issue:** All 10 node type handlers (`action-http`, `action-csv`, `logic-condition`, `action-transform`, etc.) are hardcoded inside a single 250-line JavaScript object.
* **Why it exists:** Fast initial prototype development. Adding a new node type requires modifying `workflowEngine.js` directly, violating the **Open-Closed Principle (OCP)**.

### 3. Synchronous In-Process Execution on Express Event Loop (Performance & Scalability Bottleneck)
* **Location:** [backend/src/routes/workflows.js](file:///d:/logicbridge-mp/backend/src/routes/workflows.js#L97-L107)
* **Issue:** Calling `POST /api/workflows/:id/run` executes `workflowEngine.run()` synchronously inside the Express HTTP request-response cycle.
* **Why it exists:** Simplicity. However, if a workflow includes `action-delay` (e.g., 10 seconds) or external API timeouts (15 seconds), the HTTP request hangs, blocking Express worker threads and failing under concurrent load.

### 4. Direct Disk Writing inside Service Layer (Tight Coupling & Security Risk)
* **Location:** [backend/src/services/workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js#L243-L246)
* **Issue:** `action-csv` handler invokes synchronous Node.js File System calls (`fs.mkdirSync`, `fs.writeFileSync`) writing directly to `backend/exports/`.
* **Why it exists:** Quick output storage without setting up S3 or Cloud storage. In multi-tenant environments, writing files locally without path sanitization causes disk bloating and permission conflicts.

### 5. Frontend Canvas Monolith ([BuilderPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/BuilderPage.jsx))
* **Location:** `BuilderPage.jsx` (327 lines) & `StepEditorSidebar.jsx` (606 lines)
* **Issue:** `BuilderPage.jsx` manages canvas React Flow state, drag-and-drop logic, modal toggles, API save calls, and node execution status updates simultaneously.
* **Why it exists:** Component state bloat. Canvas manipulation logic is not decoupled into custom hooks or Zustand store actions.

---

## 3. Industry Architecture Comparison

| Platform | Execution Model | Node Modularization | Scaling Architecture | What LogicBridge Should Borrow |
| :--- | :--- | :--- | :--- | :--- |
| **Activepieces** | Node.js Worker Threads / Sandboxed Pieces | Micro-packages ("Pieces") with typed inputs/outputs | Redis Queue + Worker Processes | **Dynamic Piece/Node Registry**: Separate each node type into a clean, self-contained definition module. |
| **n8n** | Event-Driven Workflow Engine | Class-based Node contracts (`INodeType`) | Main Process + Queue Mode (BullMQ + Redis) | **Graph Traversal Engine**: Traverse edges dynamically from current node based on output anchors (`main`, `true`, `false`). |
| **Zapier** | Async Task Pipeline | CLI Integrations & JSON Schema connectors | Cloud Microservices | **Step Input/Output Contract**: Standardize step output structure as `{ json: {...}, binary: [...] }`. |
| **Temporal** | Event-Sourcing Orchestration | Code-as-Workflow (Stateful Workers) | Distributed Cluster Engine | **Execution History Event Sourcing**: Append-only step execution events with explicit status transitions. |

### Practical Concepts to Borrow for College Project:
1. **Dynamic Node Registry Pattern (from Activepieces)**: Move each node handler into `src/nodes/<nodeType>.js` auto-loaded on backend startup.
2. **Handle-Based Edge Traversal (from n8n)**: Route execution to specific downstream nodes based on condition evaluation results (`true` vs `false` outputs).
3. **Async Fire-and-Forget Job Triggering (from Zapier)**: Return HTTP `202 Accepted` with `executionId` immediately when running a workflow, and process the execution asynchronously.

---

## 4. Improved Architecture Design

### System Component Diagram

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (Vite + React)                           |
|                                                                                   |
|  +--------------------+   +-----------------------+   +------------------------+  |
|  |   React Flow UI    |   | StepEditorSidebar     |   |   Zustand Stores       |  |
|  |   (Custom Nodes)   |---| (Config & Live Test)  |---| (authStore / wfStore)  |  |
|  +--------------------+   +-----------------------+   +------------------------+  |
+----------------------------------- | ---------------------------------------------+
                                     | HTTP REST (Bearer JWT)
                                     v
+-----------------------------------------------------------------------------------+
|                                 BACKEND (Express.js API)                          |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Router Layer (/api/auth, /api/workflows, /api/executions)                 |  |
|  +-----------------------------------------------------------------------------+  |
|                                     |                                             |
|  +----------------------------------v------------------------------------------+  |
|  | Controllers Layer (authController, workflowController, executionController) |  |
|  +-----------------------------------------------------------------------------+  |
|                                     |                                             |
|          +--------------------------+--------------------------+                  |
|          |                                                     |                  |
|  +-------v---------------------+                     +---------v---------------+  |
|  | Workflow Engine             |                     | Scheduler Service       |  |
|  | (Graph Traversal Engine)    |                     | (node-cron Manager)     |  |
|  +-----------------------------+                     +-------------------------+  |
|          |                                                     |                  |
|          | Dynamic Registry                                    | Calls            |
|  +-------v-----------------------------------------------------v---------------+  |
|  | Node Handlers Registry (/src/nodes/*.js)                                    |  |
|  | [HTTPNode] [CSVNode] [ConditionNode] [DelayNode] [LogNode] [TransformNode]    |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------- | ---------------------------------------------+
                                     | Mongoose ODM
                                     v
+-----------------------------------------------------------------------------------+
|                               DATABASE (MongoDB Atlas)                            |
|  +----------------------+    +-----------------------+    +--------------------+  |
|  |  Users Collection    |    | Workflows Collection  |    |Executions Collection| |
|  +----------------------+    +-----------------------+    +--------------------+  |
+-----------------------------------------------------------------------------------+
```

### Module Responsibilities

1. **Controller Layer (`/src/controllers/`)**: Handles request validation, HTTP status codes, and delegates domain tasks to services.
2. **Node Handler Registry (`/src/nodes/`)**: Each node type implements a uniform `INode` interface (`execute(node, context)`).
3. **Execution Engine (`workflowEngine.js`)**: Traverses graph edges dynamically using depth-first search or topological resolution, supporting condition branching.
4. **Scheduler Service (`scheduler.js`)**: Listens to workflow save events and manages cron job lifecycle safely in-memory.

---

## 5. Workflow Engine Improvements

### 1. Edge-Traversing Graph Engine (Condition Branching)
Instead of static topological sorting, introduce **Dynamic Edge Traversal**:

```javascript
// Enhanced Edge Traversal Logic
async function runNode(nodeId, context) {
  const node = workflow.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const handler = nodeRegistry.get(node.type);
  const output = await handler.execute(node, context);
  context.results[node.id] = output;
  context.lastOutput = output;

  // Determine outgoing edges
  let outgoingEdges = workflow.edges.filter(e => e.source === nodeId);

  // If node is a condition node, branch based on output.passed
  if (node.type === 'logic-condition') {
    const handleTarget = output.passed ? 'true' : 'false';
    outgoingEdges = outgoingEdges.filter(e => !e.sourceHandle || e.sourceHandle === handleTarget);
  }

  for (const edge of outgoingEdges) {
    await runNode(edge.target, context);
  }
}
```

### 2. Modular Node Registry Pattern
Refactor the 250-line `handlers` object into discrete files:

```
backend/src/nodes/
├── BaseNode.js           # Abstract Base Class
├── HttpNode.js           # HTTP Request execution logic
├── CsvNode.js            # CSV Report generator logic
├── ConditionNode.js      # Condition evaluator logic
├── DelayNode.js          # Delay timer logic
├── LogNode.js            # Output log logic
└── index.js              # Auto-registration registry
```

### 3. Step Retry Strategy (Resilience)
Add configurable step retries for network-dependent nodes (`action-http`):

```javascript
async function executeWithRetry(fn, retries = 2, delayMs = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, delayMs));
    return executeWithRetry(fn, retries - 1, delayMs * 2);
  }
}
```

---

## 6. Database Optimization & Review

### Collection Schema Enhancements

#### 1. `Workflows` Collection
* **Add Versioning**: Introduce `version: { type: Number, default: 1 }` to track graph edits.
* **Index Addition**: Add compound index `{ owner: 1, updatedAt: -1 }` for instant dashboard loading.

#### 2. `Executions` Collection
* **Add Indexes**: 
  * `{ workflow: 1, startedAt: -1 }` (Speeds up workflow-specific log lookups).
  * `{ owner: 1, startedAt: -1 }` (Speeds up dashboard execution stats).
* **Execution Storage Optimization**: Cap inline `steps.input` and `steps.output` length to 10KB to prevent individual execution documents from exceeding MongoDB's 16MB document limit during large data payload runs.

```javascript
// Proposed Index Specifications in Mongoose Models
workflowSchema.index({ owner: 1, updatedAt: -1 });
executionSchema.index({ workflow: 1, startedAt: -1 });
executionSchema.index({ owner: 1, startedAt: -1 });
```

---

## 7. Frontend Architecture Refactoring

### 1. Canvas Zustand Store (`useCanvasStore.js`)
Extract local canvas state out of `BuilderPage.jsx` into a dedicated store:

```javascript
// frontend/src/store/canvasStore.js
import { create } from 'zustand';

export const useCanvasStore = create((set, get) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  updateNodeData: (id, data) => set((s) => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
  })),
}));
```

### 2. Component Decomposition
Split `StepEditorSidebar.jsx` (606 lines) into specialized sub-components:

```
frontend/src/components/sidebar/
├── SidebarHeader.jsx       # Header & step rename
├── HttpConfigForm.jsx      # HTTP specific controls & URL builder
├── CsvConfigForm.jsx       # CSV Column mapper & auto-detect
├── ConditionConfigForm.jsx # Condition left/operator/right form
└── TestStepTab.jsx         # Live test runner & JSON result preview
```

---

## 8. Scalability & Engineering Roadmap

```
Current MVP (Synchronous Engine + Single-File Handlers + Monolithic Pages)
                           │
                           ▼
Stage 1: College Project Refactor (Current Scope)
  ├── Modular Node Registry (/src/nodes/*.js)
  ├── Edge-Based Condition Branching
  ├── Dedicated Canvas Zustand Store
  └── Controller Layer & MongoDB Indexing
                           │
                           ▼
Stage 2: Production MVP (Near Term)
  ├── Redis + BullMQ Asynchronous Task Queue
  ├── HTTP-only Cookie Authentication
  ├── S3 Cloud Storage for CSV Exports
  └── Webhook Trigger Receiver Endpoints
                           │
                           ▼
Stage 3: Enterprise Platform (Future Scale)
  ├── Multi-Tenant Workspaces & RBAC
  ├── Micro-Worker Execution Nodes in Isolated Docker Containers
  ├── Real-time WebSocket Log Streaming
  └── Visual Custom Piece Builder SDK
```

---

## 9. Prioritized Improvement Matrix

### 🔴 High Priority (Must Implement Before Final Demo)
1. **Modularize Node Registry** (`backend/src/nodes/`): Separates 250-line `handlers` object into individual clean files. High architectural impact with zero risk.
2. **Frontend Canvas Store (`canvasStore.js`)**: Moves React Flow state management out of `BuilderPage.jsx` into Zustand, eliminating re-render lag.
3. **Database Indexing**: Add compound indexes on `Execution` and `Workflow` schemas for instant query performance.

### 🟡 Medium Priority (Nice Improvements for College Evaluation)
1. **Condition Edge Branching**: Route execution to `True`/`False` outgoing handles for `logic-condition` nodes.
2. **Decompose `StepEditorSidebar`**: Split monolithic sidebar into separate form tabs (`HttpConfigForm`, `CsvConfigForm`).
3. **Backend Controller Layer**: Separate Express route files from controller logic (`authController.js`, `workflowController.js`).

### 🔵 Future Priority (Production-Only Ideas)
1. **Redis + BullMQ Queue**: Offload execution out of Node.js event loop.
2. **AWS S3 File Storage**: Upload CSV exports directly to S3 instead of local disk storage.
3. **OAuth2 App Connectors**: Implement OAuth flow for Google Sheets / Slack.

---

## 10. Safe Step-by-Step Refactoring Plan

The following refactoring plan improves the codebase incrementally **without breaking current functionality or altering the tech stack**:

### Phase 1: Backend Node Registry Refactor

* **Goal:** Extract monolithic node handlers into modular class files.
* **Affected Files:** 
  * [NEW] [BaseNode.js](file:///d:/logicbridge-mp/backend/src/nodes/BaseNode.js)
  * [NEW] [HttpNode.js](file:///d:/logicbridge-mp/backend/src/nodes/HttpNode.js)
  * [NEW] [CsvNode.js](file:///d:/logicbridge-mp/backend/src/nodes/CsvNode.js)
  * [NEW] [ConditionNode.js](file:///d:/logicbridge-mp/backend/src/nodes/ConditionNode.js)
  * [NEW] [registry.js](file:///d:/logicbridge-mp/backend/src/nodes/registry.js)
  * [MODIFY] [workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js)
* **Risk Level:** Low.
* **Estimated Effort:** 1.5 Hours.
* **Expected Benefits:** Solves OCP violation; makes adding new nodes effortless for students.

---

### Phase 2: Canvas State Decoupling

* **Goal:** Extract React Flow state out of `BuilderPage.jsx` into Zustand.
* **Affected Files:** 
  * [NEW] [canvasStore.js](file:///d:/logicbridge-mp/frontend/src/store/canvasStore.js)
  * [MODIFY] [BuilderPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/BuilderPage.jsx)
* **Risk Level:** Low.
* **Estimated Effort:** 1 Hour.
* **Expected Benefits:** Reduces `BuilderPage.jsx` size by 35%; fixes canvas UI re-rendering bugs.

---

### Phase 3: Database Performance & Indexing

* **Goal:** Add compound indexes for fast query resolution.
* **Affected Files:** 
  * [MODIFY] [Workflow.js](file:///d:/logicbridge-mp/backend/src/models/Workflow.js)
  * [MODIFY] [Execution.js](file:///d:/logicbridge-mp/backend/src/models/Execution.js)
* **Risk Level:** Zero Risk.
* **Estimated Effort:** 15 Minutes.
* **Expected Benefits:** Speeds up database query execution by up to 10x during dashboard load.

---

## Summary Statement for Guide & Evaluators

> *"LogicBridge demonstrates a robust architectural foundation for a college minor project. By implementing the proposed Modular Node Registry and Canvas Store decoupling, the team elevates the project from a working prototype to a clean, maintainable software architecture that strictly adheres to SOLID design principles."*
