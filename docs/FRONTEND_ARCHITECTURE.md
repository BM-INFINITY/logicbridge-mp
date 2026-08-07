# Frontend Architecture Documentation

## 1. Component Structure

The frontend application is structured into decoupled modules:

- `src/pages/BuilderPage.jsx`: Top-level orchestrator page.
- `src/components/builder/`: Modular canvas subcomponents (`Toolbar`, `Canvas`, `NodePalette`, `AIPanel`).
- `src/components/sidebar/`: Step configuration drawer subcomponents (`SidebarHeader`, `SidebarTabs`, `SidebarFactory`, `HttpConfig`, `CsvConfig`, `ConditionConfig`, `TransformConfig`, `GeneralConfig`, `TestPanel`).
- `src/components/forms/`: Reusable form controls (`TextField`, `NumberField`, `SelectField`, `SwitchField`, `KeyValueTable`, `CodeEditor`).
- `src/adapters/ReactFlowAdapter.js`: React Flow helper operations.
- `src/context/BuilderContext.jsx`: Transient UI state provider.

---

## 2. State Management Strategy

1. **`canvasStore.js` (Zustand)**: Pure UI and graph canvas state (`nodes`, `edges`, `selectedNode`, `viewport`, `history`, `executionResult`, `running`, `saving`, `showAI`, `showTemplates`). Zero API/Axios calls.
2. **`workflowStore.js` (Zustand)**: Asynchronous API network operations (`fetchWorkflows`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`, `runWorkflow`, `generateFromAI`).
3. **`BuilderContext.jsx` (React Context)**: Transient UI state (`activeTool`, `isDragging`, `hoveredNodeId`, `activePanel`).

---

## 3. Adapters & Commands

- **ReactFlowAdapter**: Encapsulates `screenToFlowPosition`, `connectEdges`, and `createNodePayload`.
- **Command Pattern (`src/commands/`)**: `AddNodeCommand`, `DeleteNodeCommand`, `DuplicateNodeCommand` abstractions preparing for undo/redo history stack implementation.
