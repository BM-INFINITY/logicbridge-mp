# Backend Architecture Documentation

## 1. 3-Tier Layering

The Express backend strictly enforces separation of concerns across three layers:

1. **Routes Layer (`src/routes/`)**: Receives HTTP requests, validates auth tokens via middleware (`protect`), and delegates execution to controller handlers.
2. **Controllers Layer (`src/controllers/`)**: Invokes domain services, handles HTTP request/response payloads using `ResponseHelper` (`success`, `error`), and delegates uncaught exceptions to `errorHandler` middleware. Zero Mongoose model calls.
3. **Services Layer (`src/services/`)**: Implements core business logic, Mongoose database queries (`userService`, `workflowService`, `executionService`), workflow engine execution (`workflowEngine`), schedule cron registration (`scheduler`), and Gemini AI prompt generation (`aiGenerator`).

---

## 2. Modular Node Registry System

- **`BaseNode.js`**: Abstract base class for node execution handlers. Defines `metadata()`, `validate(node)`, and `execute(node, context)`.
- **`registry.js`**: Singleton registry storing node class instances keyed by node type identifier (`'action-http'`, `'action-csv'`). Validates required metadata (`type`, `name`, `category`, `version`) upon startup.
- **Auto-registration**: `src/nodes/index.js` automatically imports and registers all default node classes.

---

## 3. Workflow Execution Engine & ExecutionContext

- **Topological Sorting**: `buildExecutionOrder()` uses Kahn's algorithm with node x-position fallback to determine execution order.
- **ExecutionContext**: Encapsulates runtime context (`workflowId`, `executionId`, `ownerId`, `trigger`, `results`, `lastOutput`).
- **Contextual Execution Logging**: Formats execution logs with `[Exec:ID]` and `[Node:Name]`.
- **Database Indexes**: Compound indexes `{ owner: 1, updatedAt: -1 }` on `Workflow` and `{ workflow: 1, startedAt: -1 }`, `{ owner: 1, startedAt: -1 }` on `Execution` accelerate query response times.
