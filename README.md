# LogicBridge — Workflow Automation Engine

> **Team MP_022** | Minor Project | Guide: Prof. Sonal Parmar

---

## Team Members
| Sr. | Name | Enrollment No. |
|---|---|---|
| 1 | Modi Bhavy Harshadkumar | 23012011036 |
| 2 | Patel Dhruv Kanubhai | 23012011055 |
| 3 | Patel Naisarg Dineshkumar | 23012011066 |
| 4 | Dhairya Manishbhai Thaker | 23012021007 |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Backend
```bash
cd backend
npm install
# Edit .env with your MONGODB_URI and GEMINI_API_KEY
npm run dev
# API runs on http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

---

## Project Structure
```
logicbridge/
├── backend/
│   └── src/
│       ├── models/       User, Workflow, Execution
│       ├── routes/       auth, workflows, executions
│       ├── middleware/   authMiddleware (JWT)
│       └── services/     workflowEngine, aiGenerator
└── frontend/
    └── src/
        ├── pages/        Landing, Login, Register, Dashboard, Builder, Logs
        ├── store/        authStore, workflowStore (Zustand)
        └── api/          Axios client
```

## Features Completed (Internal-1 / 30%)
- [x] Landing Page
- [x] User Registration & Login (JWT)
- [x] Protected Dashboard with Stats
- [x] Visual Drag-and-Drop Workflow Builder (React Flow)
- [x] 9 Node Types (Triggers, Actions, Logic)
- [x] AI Workflow Generation (Gemini API)
- [x] Workflow Execution Engine
- [x] Per-step Execution Logs Page
