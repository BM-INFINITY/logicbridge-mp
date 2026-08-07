# CONTEXT.md

## 1. Project Overview

* **Project Name**: LogicBridge (Team ID: `MP_022`, Guide: Prof. Sonal Parmar)
* **Purpose**: A production-grade visual workflow automation platform designed to construct, schedule, and execute multi-step automation pipelines without writing code.
* **Problem It Solves**: Simplifies complex API integrations, data transformation pipelines, scheduled exports, and student/weather reporting by providing an intuitive visual canvas, dynamic variable resolution, pre-built templates, and AI-assisted workflow creation.
* **Target Users**: Developers, system integrators, data analysts, educational administrators, and non-technical business users requiring API orchestration and automated file generation.
* **Current Development Status**: Functional MVP / Working Prototype (Minor Project for Software Engineering Automation & Developer Tools | Generative AI & LLMs | Web & Cloud Computing).
* **Overall Architecture**: Decoupled Client-Server architecture. The frontend is a React SPA built with Vite, React Flow, and Zustand. The backend is an Express.js REST API using MongoDB Atlas (via Mongoose), `node-cron` for scheduling, Axios for HTTP execution, and Google Generative AI (`@google/generative-ai`) for AI flow generation.

---

## 2. Tech Stack

### Frontend
* **Framework**: React 19 (`react` `^19.2.8`, `react-dom` `^19.2.8`)
* **UI Libraries**: Lucide React (`lucide-react` `^1.28.0`), React Hot Toast (`react-hot-toast` `^2.6.0`)
* **State Management**: Zustand (`zustand` `^5.0.14`)
* **Routing**: React Router DOM (`react-router-dom` `^7.18.2`)
* **Styling**: Vanilla CSS (Custom dark design system with variables, glassmorphism, flexbox/grid in [frontend/src/index.css](file:///d:/logicbridge-mp/frontend/src/index.css))
* **Build Tool**: Vite (`vite` `^8.2.0`, `@vitejs/plugin-react` `^6.0.4`), Oxlint (`oxlint` `^1.75.0`)

### Backend
* **Framework**: Express.js (`express` `^5.2.1`)
* **Language**: Node.js (JavaScript ES6+, CommonJS syntax)
* **API Style**: RESTful JSON API
* **Authentication**: JWT (`jsonwebtoken` `^9.0.3`) + `bcryptjs` (`^3.0.3`) password hashing
* **Background Workers**: Synchronous in-process execution via [workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js)
* **Scheduling**: `node-cron` (`^4.6.0`) running in background in-memory registry mapped by workflow ID

### Database
* **Database Engine**: MongoDB / MongoDB Atlas
* **ORM**: Mongoose (`mongoose` `^9.9.1`)
* **Schema Overview**: 3 collections: `User` (user credentials), `Workflow` (graph definition, schedule, stats), `Execution` (run history, per-step status logs)

### Infrastructure
* **Docker**: Not found in codebase.
* **Redis**: Not found in codebase.
* **Message Queue**: Not found in codebase.
* **Deployment**: Standalone Node.js server (`node src/index.js`) and Vite static bundle (`vite build`).

### AI
* **LLM Providers**: Google Gemini API via `@google/generative-ai` (`^0.24.1`)
* **Embedding Models**: Not found in codebase.
* **Vector Database**: Not found in codebase.
* **AI Libraries**: `@google/generative-ai` (Model used: `gemini-1.5-flash` with fallback to demo generator)

---

## 3. Folder Structure

```
logicbridge-mp/
├── README.md                          # Main project overview and setup instructions
├── .gitignore                         # Git ignore file for node_modules and .env files
├── backend/                           # Express.js REST API & Workflow Engine
│   ├── .env                           # Environment configuration (PORT, MONGODB_URI, JWT_SECRET, GEMINI_API_KEY)
│   ├── package.json                   # Backend dependencies & script declarations
│   ├── package-lock.json              # Backend lockfile
│   ├── exports/                       # Server-side output directory for generated CSV files
│   └── src/
│       ├── index.js                   # Application entry point, DB connection & HTTP server init
│       ├── middleware/
│       │   └── authMiddleware.js      # JWT authentication guard (protect)
│       ├── models/
│       │   ├── User.js                # User Mongoose model with bcrypt pre-save hook
│       │   ├── Workflow.js            # Workflow Mongoose model (nodes, edges, schedule)
│       │   └── Execution.js           # Execution Mongoose model (status, steps array)
│       ├── routes/
│       │   ├── auth.js                # Register, Login, Me endpoints
│       │   ├── workflows.js           # CRUD, AI generation, and Run workflow endpoints
│       │   └── executions.js          # Execution history & detail endpoints
│       └── services/
│           ├── workflowEngine.js      # Node execution handlers & topological sorter
│           ├── scheduler.js           # Cron task manager for scheduled workflows
│           └── aiGenerator.js         # Gemini 1.5 Flash prompt engine for workflow generation
└── frontend/                          # Vite React SPA
    ├── .env                           # Frontend environment file (VITE_API_URL)
    ├── .gitignore                     # Frontend gitignore
    ├── .oxlintrc.json                 # Linter configuration
    ├── index.html                     # HTML root file
    ├── package.json                   # Frontend dependencies & scripts
    ├── package-lock.json              # Frontend lockfile
    ├── README.md                      # Frontend setup guide
    ├── vite.config.js                 # Vite bundler configuration
    ├── public/                        # Static assets directory
    └── src/
        ├── main.jsx                   # React root renderer
        ├── App.jsx                    # Router, Protected Routes, and Toast container
        ├── App.css                    # Secondary app styles
        ├── index.css                  # Core CSS design system (tokens, components, nodes)
        ├── api/
        │   └── client.js              # Axios instance with automatic Bearer token interceptor
        ├── assets/                    # Media assets directory
        ├── components/
        │   ├── ExecutionPanel.jsx     # Side panel displaying step-by-step run logs
        │   ├── StepEditorSidebar.jsx  # Configuration drawer for individual workflow nodes
        │   ├── TemplatesModal.jsx     # Pre-built workflow templates selector modal
        │   └── VariablePicker.jsx     # Context-aware dynamic variable picker modal
        ├── data/
        │   └── templates.js           # Pre-built workflow definitions and node metadata
        ├── pages/
        │   ├── BuilderPage.jsx        # Drag-and-drop workflow canvas (React Flow)
        │   ├── DashboardPage.jsx      # Workflow management dashboard and stats
        │   ├── LandingPage.jsx        # Product landing page with hero & feature grid
        │   ├── LoginPage.jsx          # Authentication login screen
        │   ├── LogsPage.jsx           # Full execution history page
        │   └── RegisterPage.jsx       # Account registration screen
        └── store/
            ├── authStore.js           # Zustand store for user session & JWT
            └── workflowStore.js       # Zustand store for workflow state & actions
```

### Folder Responsibilities

* `backend/exports/`: Holds generated CSV files (e.g. `student_attendance_23012011002_2026-08-07.csv`) created by `action-csv` nodes during workflow execution.
* `backend/src/middleware/`: Contains `authMiddleware.js` which verifies the `Bearer <token>` in incoming headers and populates `req.user`.
* `backend/src/models/`: Contains Mongoose schemas (`User.js`, `Workflow.js`, `Execution.js`) defining persistent database structures.
* `backend/src/routes/`: Express route handlers organized by resource domain (`auth`, `workflows`, `executions`).
* `backend/src/services/`: Core logic layer containing the topological execution engine (`workflowEngine.js`), cron scheduler (`scheduler.js`), and LLM prompt processor (`aiGenerator.js`).
* `frontend/src/api/`: Holds `client.js` configuring an Axios client that prepends `VITE_API_URL` and attaches JWT tokens from `localStorage`.
* `frontend/src/components/`: Reusable UI modules including the React Flow side drawer (`StepEditorSidebar.jsx`), step output inspector (`ExecutionPanel.jsx`), upstream output variable selector (`VariablePicker.jsx`), and template loader (`TemplatesModal.jsx`).
* `frontend/src/data/`: `templates.js` contains sample workflows (e.g., Student Attendance, IMD Weather, Fetch & Transform) and node visual definitions (`NODE_DEFS`).
* `frontend/src/pages/`: Page-level React components matching application routes (`/`, `/login`, `/register`, `/dashboard`, `/builder`, `/logs`).
* `frontend/src/store/`: Zustand state containers management (`authStore.js` and `workflowStore.js`).

---

## 4. Frontend Architecture

### Pages
* **LandingPage** ([frontend/src/pages/LandingPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/LandingPage.jsx)): Public marketing hero, features grid, 3-step guide, and authentication CTA.
* **LoginPage** ([frontend/src/pages/LoginPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/LoginPage.jsx)): User sign-in with email/password, error handling, and redirection to `/dashboard`.
* **RegisterPage** ([frontend/src/pages/RegisterPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/RegisterPage.jsx)): Account registration with full name, email, password validation (min 6 chars).
* **DashboardPage** ([frontend/src/pages/DashboardPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/DashboardPage.jsx)): User dashboard showing statistics cards (Total Workflows, Executions, Passed/Failed runs), workflow list, creation modal, manual run button, and deletion controls.
* **BuilderPage** ([frontend/src/pages/BuilderPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/BuilderPage.jsx)): Interactive canvas for visual flow construction, drag-and-drop palette, AI generation modal, execution runner, and sidebar drawer integration.
* **LogsPage** ([frontend/src/pages/LogsPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/LogsPage.jsx)): Historical log viewer with status filters (`all`, `success`, `failed`), expandable execution items, and step-level output inspection.

### Components
* **StepEditorSidebar** ([frontend/src/components/StepEditorSidebar.jsx](file:///d:/logicbridge-mp/frontend/src/components/StepEditorSidebar.jsx)): Right-side panel opening on node click. Contains **Configuration** (URL, Method, Headers, Query Params, CSV Column mapping, Cron, Condition fields) and **Test Step** tabs. Supports **Auto-Detect Columns** for CSV node.
* **VariablePicker** ([frontend/src/components/VariablePicker.jsx](file:///d:/logicbridge-mp/frontend/src/components/VariablePicker.jsx)): Modal displaying field schemas from all upstream nodes. Clicking a field inserts `{{ step_id.field }}` into the active input.
* **ExecutionPanel** ([frontend/src/components/ExecutionPanel.jsx](file:///d:/logicbridge-mp/frontend/src/components/ExecutionPanel.jsx)): Slide-over drawer displaying total duration, step pass/fail summary, and formatted JSON output for each step.
* **TemplatesModal** ([frontend/src/components/TemplatesModal.jsx](file:///d:/logicbridge-mp/frontend/src/components/TemplatesModal.jsx)): Modal displaying 6 pre-built workflow templates (Student Attendance, IMD Weather, Fetch API, Weather Check, Condition Flow, Multi-Step API).

### Layouts
* **Sidebar Layout**: `Sidebar` sub-component rendered in `DashboardPage` and `LogsPage` providing common navigation links and user logout options.
* **Builder Layout**: Top toolbar (Back button, Workflow Name input, Templates button, AI button, Save button, Run button), left Node Palette, central canvas, and right Step Editor drawer.

### Context Providers & Store Integrations
* Zustand stores used directly inside components:
  * `useAuthStore`: Session management, JWT persistence in `localStorage` (`lb_token`), `user` profile state.
  * `useWorkflowStore`: `workflows` list state, `currentWorkflow` state, API sync functions.

### Hooks
* React Standard Hooks: `useState`, `useEffect`, `useCallback`, `useRef`.
* Router Hooks: `useParams`, `useNavigate`, `useLocation`.
* React Flow Hooks: `useNodesState`, `useEdgesState`.

### API Layer
* Axios client configured in [frontend/src/api/client.js](file:///d:/logicbridge-mp/frontend/src/api/client.js).
* Interceptor automatically attaches header `Authorization: Bearer <token>` from `localStorage.getItem('lb_token')`.

### React Flow Implementation
* Implemented in [frontend/src/pages/BuilderPage.jsx](file:///d:/logicbridge-mp/frontend/src/pages/BuilderPage.jsx).
* Custom Node Component (`CustomNode`) maps each `node.type` to visual elements featuring colored category icons, target/source connection handles (`Handle`), custom status indicators (green checkmark for success, red cross for failure, spinner for running), and quick data previews.
* Node Palette allows HTML5 drag-and-drop (`onDragStart`, `onDrop`, `screenToFlowPosition`).
* Edge connections created via `onConnect` with default animated purple stroke (`#6c63ff`).

### Workflow Builder Data Flow
1. User drags node from palette to canvas → `setNodes` appends node object.
2. User clicks node → `setSelectedNode` mounts `StepEditorSidebar`.
3. User edits node properties → `onUpdate` mutates node `data` object in React Flow state.
4. User clicks "Save" → `updateWorkflow(id, { name, nodes, edges, status })` sends graph JSON to backend (`PUT /api/workflows/:id`).
5. User clicks "Run" → `runWorkflow(id)` posts execution request (`POST /api/workflows/:id/run`).
6. Engine executes graph → frontend updates node visual borders (`_execStatus`) and mounts `ExecutionPanel` with step logs.

---

## 5. Backend Architecture

### API Structure
* Express application initialized in [backend/src/index.js](file:///d:/logicbridge-mp/backend/src/index.js).
* Middleware stack: `cors({ origin: '*' })`, `express.json()`.
* Routes mounted at:
  * `/api/auth` → [auth.js](file:///d:/logicbridge-mp/backend/src/routes/auth.js)
  * `/api/workflows` → [workflows.js](file:///d:/logicbridge-mp/backend/src/routes/workflows.js)
  * `/api/executions` → [executions.js](file:///d:/logicbridge-mp/backend/src/routes/executions.js)

### Services & Logic Layer
* **workflowEngine** ([backend/src/services/workflowEngine.js](file:///d:/logicbridge-mp/backend/src/services/workflowEngine.js)):
  * Contains `handlers` dictionary for all 10 node types (`trigger-manual`, `trigger-schedule`, `action-http`, `action-log`, `action-delay`, `action-transform`, `logic-condition`, `action-csv`).
  * Implements `buildExecutionOrder(nodes, edges)` using Kahn's Topological Sort algorithm (with fallbacks based on `position.x`).
  * Resolves variable templates matching `{{ step_id.field }}` or `{{ prev.field }}` across step context outputs.
  * Handles HTTP requests with 10-second redirect following (`maxRedirects: 10`), query parameter injection, custom headers, and status validation (`status < 500`).
  * Handles CSV generation by inspecting nested arrays (`records`, `data`, `items`, `results`), mapping column headers/values, formatting cells with quotes/delimiters, and saving to disk (`/backend/exports/<filename>_<date>.csv`).
* **scheduler** ([backend/src/services/scheduler.js](file:///d:/logicbridge-mp/backend/src/services/scheduler.js)):
  * In-memory `activeTasks` Map tracking `node-cron` task objects by workflow ID.
  * `scheduleWorkflow(workflow)`: Parses `cron` string from `trigger-schedule` node data and schedules execution under `Asia/Kolkata` timezone.
  * `unscheduleWorkflow(workflowId)`: Cancels active cron task when workflow status changes to inactive/draft or node is removed.
  * `initScheduler()`: Scans database on server start (`Workflow.find({ status: 'active' })`) and restores active cron schedules.
* **aiGenerator** ([backend/src/services/aiGenerator.js](file:///d:/logicbridge-mp/backend/src/services/aiGenerator.js)):
  * Interacts with Google Gemini API via `@google/generative-ai` (`gemini-1.5-flash`).
  * Prompts model with `NODE_CATALOG` and strict JSON structure rules.
  * Returns auto-generated nodes array spaced horizontally at 250px increments with valid edge connections.
  * Fallback: Provides `getDemoWorkflow` if `GEMINI_API_KEY` is not configured or request fails.

### Controllers & Middleware
* **authMiddleware** ([backend/src/middleware/authMiddleware.js](file:///d:/logicbridge-mp/backend/src/middleware/authMiddleware.js)): `protect` function checks `req.headers.authorization`, verifies token via `jwt.verify`, and attaches user document (`select('-password')`) to `req.user`.

### Dependency Injection
* Standard Node.js CommonJS module `require` pattern.

### Background Workers & Execution Engine
* In-process async execution. When `/api/workflows/:id/run` or a cron timer fires, `workflowEngine.run(workflow, ownerId, trigger)` executes sequentially through topologically sorted nodes, recording step durations, inputs, outputs, and failures into an `Execution` Mongoose document.

---

## 6. Database

### Models / Tables

#### 1. User Model ([backend/src/models/User.js](file:///d:/logicbridge-mp/backend/src/models/User.js))
* **Collection**: `users`
* **Fields**:
  * `name`: `{ type: String, required: true, trim: true }`
  * `email`: `{ type: String, required: true, unique: true, lowercase: true, trim: true }`
  * `password`: `{ type: String, required: true, minlength: 6 }` (Hashed with `bcryptjs`)
  * `avatar`: `{ type: String, default: '' }`
  * `createdAt` / `updatedAt`: Timestamps enabled
* **Methods**: `userSchema.pre('save')` hashes password with salt rounds 12; `matchPassword(enteredPassword)` compares password hashes.

#### 2. Workflow Model ([backend/src/models/Workflow.js](file:///d:/logicbridge-mp/backend/src/models/Workflow.js))
* **Collection**: `workflows`
* **Fields**:
  * `name`: `{ type: String, required: true, trim: true }`
  * `description`: `{ type: String, default: '' }`
  * `owner`: `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
  * `status`: `{ type: String, enum: ['active', 'inactive', 'draft'], default: 'draft' }`
  * `nodes`: `{ type: Array, default: [] }` (Stores React Flow node objects, positions, and step configurations)
  * `edges`: `{ type: Array, default: [] }` (Stores React Flow edge connections)
  * `schedule`: `{ enabled: Boolean, cron: String }`
  * `lastRunAt`: `{ type: Date, default: null }`
  * `runCount`: `{ type: Number, default: 0 }`
  * `aiGenerated`: `{ type: Boolean, default: false }`
  * `createdAt` / `updatedAt`: Timestamps enabled

#### 3. Execution Model ([backend/src/models/Execution.js](file:///d:/logicbridge-mp/backend/src/models/Execution.js))
* **Collection**: `executions`
* **Fields**:
  * `workflow`: `{ type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true }`
  * `owner`: `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
  * `status`: `{ type: String, enum: ['running', 'success', 'failed'], default: 'running' }`
  * `trigger`: `{ type: String, enum: ['manual', 'schedule', 'webhook'], default: 'manual' }`
  * `steps`: Array of `stepLogSchema`:
    * `nodeId`: String
    * `nodeName`: String
    * `nodeType`: String
    * `status`: `{ type: String, enum: ['success', 'failed', 'skipped'], default: 'success' }`
    * `input`: `mongoose.Schema.Types.Mixed`
    * `output`: `mongoose.Schema.Types.Mixed`
    * `error`: `{ type: String, default: null }`
    * `duration`: `{ type: Number, default: 0 }` (ms)
  * `startedAt`: `{ type: Date, default: Date.now }`
  * `finishedAt`: `{ type: Date, default: null }`
  * `duration`: `{ type: Number, default: 0 }` (total ms)
  * `error`: `{ type: String, default: null }`
  * `createdAt` / `updatedAt`: Timestamps enabled

### Entity-Relationship Diagram

```
+-------------------+             +-----------------------+
|       User        | 1         * |       Workflow        |
|-------------------|-------------|-----------------------|
| _id (PK)          |             | _id (PK)              |
| name              |             | owner (FK -> User)    |
| email (Unique)    |             | name                  |
| password (Hashed) |             | nodes []              |
+-------------------+             | edges []              |
          |                       | status                |
          |                       +-----------------------+
          |                                   |
          | 1                                 | 1
          |                                   |
          | *                                 | *
+---------------------------------------------------------+
|                       Execution                         |
|---------------------------------------------------------|
| _id (PK)                                                |
| workflow (FK -> Workflow)                               |
| owner (FK -> User)                                      |
| status (running | success | failed)                     |
| trigger (manual | schedule | webhook)                   |
| steps [ { nodeId, status, input, output, duration } ]   |
+---------------------------------------------------------+
```

### Migrations & Indexes
* **Migrations**: Mongoose schema auto-sync. No external migration tool (e.g. `db-migrate` or `prisma`) configured.
* **Indexes**: Default `_id` index; `email` unique index on `User` collection (`{ email: 1 }, { unique: true }`).

---

## 7. Authentication

* **Registration Flow**: `POST /api/auth/register` validates input, checks duplicate email, hashes password using `bcryptjs` (salt 12), creates User document, and returns user data + JWT token (`expiresIn: '30d'`).
* **Login Flow**: `POST /api/auth/login` checks email, verifies password via `bcrypt.compare`, and returns user payload + signed JWT token.
* **Session Management**: Client stores JWT token in `localStorage` under key `lb_token`. On reload, `fetchMe()` sends request to `GET /api/auth/me` to populate user context in `authStore.js`.
* **OAuth**: Not found in codebase.
* **RBAC (Role-Based Access Control)**: Basic User Isolation — All workflow and execution endpoints filter queries by `owner: req.user._id`. No administrative or multi-tenant roles currently exist.
* **Middleware**: `protect` in [backend/src/middleware/authMiddleware.js](file:///d:/logicbridge-mp/backend/src/middleware/authMiddleware.js) extracts Bearer token, verifies secret via `jwt.verify(token, process.env.JWT_SECRET)`, and sets `req.user`.

---

## 8. Workflow Engine

### Complete Execution Architecture

```
User Click / Cron Trigger
         ↓
  POST /api/workflows/:id/run  (or Scheduler Callback)
         ↓
  workflowEngine.run(workflow, ownerId, trigger)
         ↓
  buildExecutionOrder(nodes, edges)  [Topological Sort]
         ↓
  Loop through sorted nodes sequentially:
    ├── Step Start Timestamp
    ├── Lookup Handler in registry handlers[node.type]
    ├── Resolve mustache templates {{ step_id.field }} / {{ prev.field }}
    ├── Execute Handler (HTTP Request / CSV Gen / Condition Check / Delay / Log)
    ├── Pass output to context.lastOutput & context.results[node.id]
    ├── Append step log to steps array
    └── On Error: Mark step status 'failed', record error, abort loop
         ↓
  Save Execution document in MongoDB Atlas with status ('success' | 'failed')
         ↓
  Update Workflow model (runCount + 1, lastRunAt = Date.now())
         ↓
  Return Execution payload to client
```

### Supported Node Types Catalog

| Node Type | Category | Description | Data Configuration Fields |
| :--- | :--- | :--- | :--- |
| `trigger-manual` | Trigger | Manual start trigger | `label` |
| `trigger-schedule` | Trigger | Scheduled cron trigger | `label`, `cron` |
| `trigger-webhook` | Trigger | Webhook listener | `label` |
| `action-http` | Action | HTTP Request dispatcher | `url`, `method`, `body`, `queryParamsList`, `headersList` |
| `action-log` | Action | Output logger | `message` (supports `{{prev}}`) |
| `action-delay` | Action | Pause execution | `seconds` |
| `action-transform` | Action | JSON Transformer | `template` |
| `action-email` | Action | Send Email placeholder | `to`, `subject`, `body` |
| `action-csv` | Action | Smart CSV Report Generator | `filename`, `delimiter`, `includeHeaders`, `arrayPath`, `columns` |
| `logic-condition` | Logic | If/Else gate | `leftValue`, `operator`, `rightValue` |

### Node & Edge Storage
* Stored directly inside the `Workflow` Mongoose document as JSON arrays:
  * `nodes`: Array of objects storing `id`, `type`, `position` (`{ x, y }`), and `data` (configuration properties).
  * `edges`: Array of objects storing `id`, `source` (node ID), `target` (node ID), `animated: true`.

### Execution Flow & Order Resolution
* Topologically ordered via Kahn's algorithm in `buildExecutionOrder(nodes, edges)`.
* Computes in-degree for each node based on directed edges. Nodes with 0 incoming edges are added to queue and processed sequentially.
* If cycles exist or edges are omitted, falls back to sorting nodes by canvas `x` coordinate (`position.x`).

### Variable Resolution Mechanism
* Expression resolver uses regular expressions: `/\{\{\s*([^}]+)\s*\}\}/g`
* Strips prefixes like `step_n.`, `prev.`, `data.`, or `records.` and searches for keys in `context.lastOutput` or current row object.

### Error Handling & Retries
* **Error Handling**: Wrapped in `try...catch` block inside `workflowEngine.run()`. If a node throws an error (e.g. invalid HTTP URL, missing dataset for CSV), execution breaks immediately, records the failure message in the step log, marks the execution status as `failed`, and persists the state.
* **Retry Mechanism**: Not found in codebase.

---

## 9. AI Features

### Capabilities
* **Natural Language to Workflow Generation**: Users describe desired automations (e.g., *"Fetch weather from IMD API every morning and generate CSV report"*) in `AIPanel` on `BuilderPage`.
* **Endpoint**: `POST /api/workflows/generate` handles prompt processing via `aiGenerator.generate(prompt)`.
* **Model**: Uses Google Gemini 1.5 Flash (`gemini-1.5-flash`) through `@google/generative-ai`.
* **Prompt Engineering**: Uses structured system instructions defining node catalog, layout constraints (x-spacing: 250px, y-center: 200px), and strict JSON response formatting rules.
* **Demo Fallback**: `getDemoWorkflow(userPrompt)` returns a pre-structured 4-node workflow (Manual Trigger → HTTP Node → Condition Node → Log Node) if `GEMINI_API_KEY` is missing or API call fails.

### Future AI Integration Points
* Not found in codebase (No vector embeddings or automated agent execution currently integrated).

---

## 10. APIs

### Auth Endpoints (`/api/auth`)

| Route | Method | Request Body | Response Payload | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | `{ name, email, password }` | `{ _id, name, email, token }` | No | Register new user account |
| `/api/auth/login` | `POST` | `{ email, password }` | `{ _id, name, email, token }` | No | Authenticate user & receive JWT |
| `/api/auth/me` | `GET` | — | User object (excluding `password`) | Yes (`Bearer`) | Validate current session |

### Workflow Endpoints (`/api/workflows`)

| Route | Method | Request Body | Response Payload | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workflows` | `GET` | — | Array of Workflow objects | Yes (`Bearer`) | List all user workflows |
| `/api/workflows` | `POST` | `{ name, description, nodes, edges }` | Created Workflow object | Yes (`Bearer`) | Create new workflow |
| `/api/workflows/generate` | `POST` | `{ prompt }` | `{ name, description, nodes, edges }` | Yes (`Bearer`) | AI generate workflow from text prompt |
| `/api/workflows/:id` | `GET` | — | Workflow object | Yes (`Bearer`) | Get workflow details by ID |
| `/api/workflows/:id` | `PUT` | `{ name, status, nodes, edges, schedule }` | Updated Workflow object | Yes (`Bearer`) | Update workflow & reschedule cron |
| `/api/workflows/:id` | `DELETE` | — | `{ message: "Workflow deleted" }` | Yes (`Bearer`) | Delete workflow & related executions |
| `/api/workflows/:id/run` | `POST` | — | Execution object | Yes (`Bearer`) | Manually trigger workflow execution |

### Execution Endpoints (`/api/executions`)

| Route | Method | Request Body | Response Payload | Auth Required | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/executions` | `GET` | — | Array of 20 recent executions (populated with workflow name) | Yes (`Bearer`) | Fetch user dashboard execution stats |
| `/api/executions/:workflowId` | `GET` | — | Array of 50 recent executions for specific workflow | Yes (`Bearer`) | Fetch execution history for workflow |
| `/api/executions/detail/:id` | `GET` | — | Detailed Execution object with populated workflow name | Yes (`Bearer`) | Get single execution details |

---

## 11. Integrations

* **Google Apps Script Web Apps**: Tested with Google Apps Script macro endpoints for fetching student attendance data. Handles `302` HTTP redirects automatically via Axios configuration.
* **India Meteorological Department (IMD) API**: Connects to `api.imd.gov.in` for real-time weather observation data.
* **Custom HTTP APIs**: Support for arbitrary `GET`, `POST`, `PUT`, `DELETE` endpoints with custom headers, JSON request bodies, and query parameter builders.
* **Google Gemini AI**: Integration via `@google/generative-ai` SDK.
* **OAuth**: Not found in codebase.
* **Webhooks**: Node type `trigger-webhook` present in catalog; incoming webhook receiver route not found in codebase.

---

## 12. Current Features

### Completed
* User Authentication (Registration, Login, JWT session persistence, password hashing).
* Visual Drag & Drop Canvas (React Flow with custom nodes, handles, edges, minimap, controls).
* Activepieces-Style Step Editor Drawer (`StepEditorSidebar`) with Configuration and Live Step Testing tabs.
* Dynamic Variable Picker (`{{ step_id.field }}` / `{{ prev.field }}`).
* Smart CSV Generator (`action-csv`) with nested array auto-discovery, auto-detect column header mapping, custom delimiter choices, and disk export saving (`/backend/exports/`).
* HTTP Action Node with 10-second redirect handling, Query Parameter visual table builder, and Header builder.
* Scheduled Automation Engine (`node-cron`) with IST timezone support and automatic background job initialization on server start.
* Step-by-Step Execution Logging & Detailed Log History Viewer (`ExecutionPanel` & `LogsPage`).
* AI Workflow Generation via Google Gemini 1.5 Flash (`POST /api/workflows/generate`).
* Pre-built Workflow Templates (Student Attendance → CSV, IMD Weather → CSV, Fetch API, Weather Check, Condition Flow, Multi-Step Pipeline).

### In Progress
* Webhook trigger receiver implementation.
* Live real-time canvas step status animations during cron execution.

### Planned
* Multi-user organization workspace support.
* Visual branch rendering for condition nodes (`True`/`False` path edge splitters).

---

## 13. Missing Features (Comparison with Activepieces / n8n)

### Missing Workflow Capabilities
* Sub-workflow / Child workflow execution nodes.
* Parallel branch execution (All nodes currently run sequentially via topological sort loop).
* Loop / Iteration nodes (e.g. `For Each` loop over items).
* Error-handling branches / `On Failure` fallback paths.
* Pause / Wait for User Approval nodes.

### Missing Integrations
* Third-party OAuth App connectors (e.g., Slack, Google Sheets OAuth, Discord, GitHub, Notion, Airtable, Twilio).
* Built-in Email node execution (Node definition `action-email` exists in catalog, but handler is not implemented in `workflowEngine.js`).

### Missing AI Features
* RAG / Vector store integrations.
* LLM Agent execution nodes within the workflow canvas (e.g. OpenAI/Gemini node inside workflow steps).

### Missing UX Features
* Undo / Redo history canvas stack.
* Multi-select node movement.
* Real-time WebSocket execution status streams (currently relies on REST responses).

---

## 14. Execution Flow

```
Trigger Event (Manual Click or Cron Timer)
                    ↓
   Express Route POST /api/workflows/:id/run
                    ↓
       Retrieve Workflow from MongoDB
                    ↓
  workflowEngine.run(workflow, ownerId, trigger)
                    ↓
   Topological Sort Nodes via Edges Graph
                    ↓
       Initialize Context & Results Map
                    ↓
  For each Node in Topological Order:
    ├── Set Step Status = "running"
    ├── Resolve Variables {{ step_id.field }} from Previous Outputs
    ├── Execute Handler (e.g., HTTP Call / CSV Generation)
    ├── Capture Response Payload & Duration (ms)
    └── Update Context (context.lastOutput = output)
                    ↓
  Create Execution Document in MongoDB (status: 'success' | 'failed')
                    ↓
  Increment Workflow runCount & update lastRunAt
                    ↓
  Return Execution JSON Payload to Client
                    ↓
  Frontend updates node badges and displays ExecutionPanel
```

---

## 15. Configuration

### Environment Variables

#### Backend (`/backend/.env`)
* `PORT`: Server port (Default: `3001`)
* `MONGODB_URI`: MongoDB connection string (e.g., `mongodb+srv://...` or `mongodb://localhost:27017/logicbridge`)
* `JWT_SECRET`: Secret key for signing JWT tokens
* `GEMINI_API_KEY`: API Key for Google Generative AI

#### Frontend (`/frontend/.env`)
* `VITE_API_URL`: Backend API base URL (Default: `http://localhost:3001`)

### Config Files
* `frontend/vite.config.js`: Vite configuration with React plugin (`@vitejs/plugin-react`).
* `frontend/.oxlintrc.json`: Linter rule configuration.
* `backend/package.json`: Node script definitions (`start`, `dev`).

### Docker & Deployment Setup
* Dockerfile / Docker Compose: Not found in codebase.
* Production Deployment: Requires running Express backend via `node src/index.js` (or PM2) and serving built Vite frontend static files via Nginx or Vercel/Netlify.

---

## 16. Dependencies

### Backend Dependencies (`backend/package.json`)
* `@google/generative-ai` (`^0.24.1`): Official SDK for Google Gemini AI models.
* `axios` (`^1.19.0`): Promise-based HTTP client for external API node requests.
* `bcryptjs` (`^3.0.3`): Password hashing algorithm for user security.
* `cors` (`^2.8.6`): Cross-Origin Resource Sharing middleware for Express.
* `dotenv` (`^17.4.2`): Loads environment variables from `.env` file.
* `express` (`^5.2.1`): Web server framework for API endpoints.
* `jsonwebtoken` (`^9.0.3`): JWT authentication token generation and verification.
* `mongoose` (`^9.9.1`): MongoDB Object Data Modeling (ODM) library.
* `node-cron` (`^4.6.0`): Cron job scheduler for recurring workflow execution.
* `nodemailer` (`^9.0.4`): Node mailer package installed for email capabilities.

### Frontend Dependencies (`frontend/package.json`)
* `react` (`^19.2.8`) & `react-dom` (`^19.2.8`): UI view library.
* `reactflow` (`^11.11.4`): Visual node-based workflow graph renderer and state manager.
* `zustand` (`^5.0.14`): Lightweight state management store for auth and workflow state.
* `react-router-dom` (`^7.18.2`): Single-page app client routing.
* `axios` (`^1.19.0`): Client-side API requests to Express backend.
* `lucide-react` (`^1.28.0`): SVG icon set.
* `react-hot-toast` (`^2.6.0`): Toast notification alerts.
* `vite` (`^8.2.0`): Development server and bundler.
* `oxlint` (`^1.75.0`): JS/JSX linter.

---

## 17. Coding Standards

### Project Conventions
* **CommonJS on Backend**: Uses `require()` and `module.exports`.
* **ES Modules on Frontend**: Uses `import` and `export default`.
* **Naming Conventions**:
  * Files: PascalCase for React Components (`StepEditorSidebar.jsx`, `BuilderPage.jsx`), camelCase for utility/service/route files (`workflowEngine.js`, `authMiddleware.js`, `client.js`).
  * API Routes: Lowercase plural nouns (`/api/workflows`, `/api/executions`).
  * CSS Variables: Kebab-case prefixed with `--` (e.g. `--bg-base`, `--accent-primary`).
* **Architectural Patterns**:
  * Decoupled REST architecture.
  * Modular Service Layer (`workflowEngine`, `scheduler`, `aiGenerator`) decoupled from Route Handlers.
  * Store-Driven Frontend State (Zustand stores wrap API endpoints to insulate UI components).

---

## 18. Known Issues

* **Missing Email Action Handler**: `action-email` node is listed in `NODE_CATALOG` and `NODE_DEFS`, but `workflowEngine.js` does not contain an `action-email` handler implementation in its `handlers` map.
* **Topological Sort Single-Branch Limitation**: Condition node evaluation (`logic-condition`) returns `{ passed: true/false }`, but the linear execution loop processes all nodes sequentially regardless of condition result rather than splitting execution down distinct True/False edge paths.
* **Cron Task Persistence Across Server Restarts**: Cron tasks are initialized from DB on startup, but updating a workflow's schedule directly mutates memory map; if server restarts, only active status workflows are re-scheduled.
* **Hardcoded Sample Keys Fallback**: `VariablePicker.jsx` uses hardcoded fallback keys when upstream outputs haven't been executed yet.

---

## 19. Team Progress

* **Modules Implemented (100%)**:
  * User Authentication & JWT Security.
  * Visual Drag & Drop Canvas (React Flow Integration).
  * HTTP Node Handler with Query Params & Headers.
  * Smart CSV Report Generator with disk file writing.
  * Cron Scheduling Service (`node-cron`).
  * Execution History & Log Inspection UI.
  * AI Workflow Generation (Gemini 1.5 Flash).
  * Pre-built Workflow Templates.
* **Modules Partially Completed**:
  * `logic-condition` Node (Evaluates condition, but doesn't branch graph execution paths).
  * `action-transform` Node (Basic JSON template replacement).
* **Modules Not Started**:
  * `action-email` Handler Implementation.
  * Incoming Webhook Trigger Endpoint (`POST /api/webhooks/:id`).
  * Third-party OAuth Connectors.

---

## 20. Recommendations

1. **Implement True Branching for Logic Nodes**: Update `buildExecutionOrder()` and `workflowEngine.run()` to follow conditional edges dynamically based on `logic-condition` evaluation (`true` branch vs `false` branch).
2. **Add Asynchronous Task Queue (BullMQ / Redis)**: Replace in-process synchronous execution in `workflowEngine.run()` with a background job queue to prevent long-running HTTP requests or large CSV generation from blocking the main Express event loop.
3. **Complete `action-email` Handler**: Implement `nodemailer` transport inside `handlers['action-email']` using SMTP environment credentials.
4. **Implement Webhook Triggers**: Add a public endpoint `POST /api/triggers/webhook/:workflowId` to allow external platforms (GitHub, Stripe, Typeform) to trigger workflows asynchronously.
5. **Add Docker Compose Setup**: Provide a `docker-compose.yml` orchestrating MongoDB, Backend, and Frontend containers for streamlined deployment.

---

## 21. Quick Start

### Prerequisites
* Node.js (v18+)
* MongoDB Atlas connection string or local MongoDB running at `mongodb://localhost:27017`

### 1. Backend Setup
```bash
cd backend
npm install
```
Create `.env` inside `/backend`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/logicbridge
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```
Run backend in development mode:
```bash
npm run dev
# Server running at http://localhost:3001
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Create `.env` inside `/frontend`:
```env
VITE_API_URL=http://localhost:3001
```
Run frontend in development mode:
```bash
npm run dev
# Frontend running at http://localhost:5173
```

### Build Commands
* Frontend Production Build: `cd frontend && npm run build`
* Frontend Preview: `cd frontend && npm run preview`
* Frontend Linter: `cd frontend && npm run lint`

---

## 22. Overall Assessment

* **Project Maturity**: **82%** (Core functionality fully operational, sleek UI, working backend execution engine, AI generator, CSV exporter, and cron scheduler).
* **Strengths**:
  * Extremely clean, modern dark UI aesthetic with seamless glassmorphism styling.
  * Real-world functional nodes (Google Apps Script redirection, IMD Weather integration, Smart CSV Generator).
  * Context-aware dynamic variable resolution (`{{ step_id.field }}`).
  * Gemini 1.5 Flash AI flow generation with robust demo fallback.
* **Weaknesses**:
  * Conditional logic does not split graph branch paths.
  * Absence of background queue (BullMQ/Redis) for execution isolation.
  * Unimplemented email action handler.
* **Readiness for Demonstration**: **High / Production Ready for Demo** (Team MP_022 presentation ready).
* **Suggested Next Priorities**:
  1. Add branch path execution for `logic-condition` nodes.
  2. Implement `action-email` via `nodemailer`.
  3. Add Webhook HTTP trigger listener endpoint.
