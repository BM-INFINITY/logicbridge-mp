# Architectural Dependency Rules

To maintain long-term maintainability and clear separation of concerns, all developers must adhere to the following strict dependency flow rules.

---

## 1. Backend Dependency Flow Rules

```text
Routes  ──►  Controllers  ──►  Services  ──►  Models / Nodes / Utils / Errors
```

### Directives
- **Routes Layer** MUST ONLY import controllers and auth middleware.
- **Controllers Layer** MUST NOT import Mongoose models directly. They MUST call domain services (`userService`, `workflowService`, `executionService`).
- **Controllers Layer** MUST use `ResponseHelper` (`success`, `error`) for sending HTTP responses.
- **Services Layer** encapsulates database interactions (Mongoose queries) and business logic.
- **Node Handlers** MUST NOT depend on controllers or routes. They depend on `BaseNode`, `utils`, and `errors`.
- **Utils & Errors** MUST NOT import controllers, routes, or services.

---

## 2. Frontend Dependency Flow Rules

```text
Pages  ──►  Builder & Sidebar Components  ──►  Forms / Hooks / Adapters  ──►  Stores / Config / Constants / API
```

### Directives
- **Pages** (`BuilderPage.jsx`) compose top-level layout components.
- **Components** (`Canvas`, `Toolbar`, `StepEditorSidebar`) invoke custom hooks (`useCanvasActions`, `useNodeOperations`), adapters (`ReactFlowAdapter`), and Zustand stores (`useCanvasStore`, `useWorkflowStore`).
- **`canvasStore.js`** MUST NOT contain API calls (`axios`, `API.get`, `API.post`). Network calls belong exclusively to `workflowStore.js`.
- **Forms Layer** (`TextField`, `CodeEditor`, `KeyValueTable`) contains reusable, pure presentational controls.
- **Constants & Config** MUST NOT depend on React components or stores.
