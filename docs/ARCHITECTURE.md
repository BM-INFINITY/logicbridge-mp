# LogicBridge Architecture Overview

LogicBridge is a visual workflow automation platform designed for low-code/no-code workflow construction, scheduled trigger execution, HTTP integration, JSON data transformation, and automated CSV generation.

---

## 1. System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        React Flow Frontend Client                      │
│                                                                        │
│   ┌────────────────────┐   ┌────────────────────┐   ┌──────────────┐   │
│   │   Builder Canvas   │   │  Sidebar Drawer    │   │  Zustand     │   │
│   │   Subcomponents    │   │  & Form Controls   │   │  CanvasStore │   │
│   └─────────┬──────────┘   └─────────┬──────────┘   └──────┬───────┘   │
└─────────────┼────────────────────────┼─────────────────────┼───────────┘
              │                        │                     │
              ▼                        ▼                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Express 3-Tier Backend System                      │
│                                                                        │
│   Routes Layer  ──►  Controllers Layer  ──►  Services Layer        │
│   (Express)          (auth, workflow,        (user, workflow,          │
│                      execution)              execution, engine)        │
│                                                     │                  │
│                                                     ▼                  │
│                                              Node Registry             │
│                                              (BaseNode handlers)       │
└─────────────────────────────────────────────────────┬──────────────────┘
                                                      │
                                                      ▼
                                             MongoDB Storage
```

---

## 2. Key Subsystems

1. **Frontend Builder Layer**: Built with React, React Flow, and Zustand (`canvasStore.js`). Uses modular builder subcomponents (`Toolbar`, `Canvas`, `NodePalette`, `AIPanel`) and sidebar configuration form components (`HttpConfig`, `CsvConfig`, `ConditionConfig`, `TransformConfig`, `GeneralConfig`).
2. **Backend Express API**: Follows a strict 3-tier architecture: **Routes → Controllers → Services → Models**.
3. **Node Registry System**: Dynamic singleton registry (`NodeRegistry`) managing node execution handlers inheriting from `BaseNode`.
4. **Workflow Execution Engine**: Sequential executor implementing Kahn's topological sorting algorithm, `ExecutionContext` runtime encapsulation, and structured step logging.

---

## 3. Extension Guidelines

- **Adding a New Node Type**:
  1. Extend `BaseNode` in `backend/src/nodes/<NodeName>.js` implementing `metadata()`, `validate()`, and `execute()`.
  2. Auto-registered upon startup in `backend/src/nodes/index.js`.
  3. Add definition to `frontend/src/constants/NodeTypes.js` and `frontend/src/data/templates.js`.
