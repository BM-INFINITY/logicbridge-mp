# ⚡ LogicBridge — Production-Grade Workflow Automation Engine

> **Team ID:** MP_022 | **Guide:** Prof. Sonal Parmar  
> **Project Domain:** Software Engineering Automation & Developer Tools | Generative AI & LLMs | Web & Cloud Computing

LogicBridge is a visual workflow automation platform inspired by Activepieces and Zapier. It empowers users to seamlessly build, configure, and execute automated multi-step pipelines with drag-and-drop node editing, dynamic variable substitution, user-defined CSV mapping, Google Apps Script integration, and AI-assisted flow generation.

---

## 👥 Team Members

| Sr. | Name | Enrollment No. | Role |
|:---:|:---|:---:|:---|
| 1 | **MODI BHAVY HARSHADKUMAR** | 23012011036 | Full Stack & Engine Architecture |
| 2 | **PATEL DHRUV KANUBHAI** | 23012011055 | Backend APIs & Integrations |
| 3 | **PATEL NAISARG DINESHKUMAR** | 23012011066 | UI/UX & Flow Canvas |
| 4 | **DHAIRYA MANISHBHAI THAKER** | 23012021007 | Database & Deployment |

---

## 🚀 Key Features

### 🎛️ 1. Activepieces-Style Step Editor Drawer
- **Reactive Sidebar**: Clicking any node opens a right-side drawer with tabs for **Configuration** and **Test Step**.
- **User-Centric Configuration**: Complete flexibility to modify request URLs, headers, body, schedule cron expressions, delimiters, and file naming templates.

### 🔮 2. Dynamic Variable Picker (`{{ step_id.field }}`)
- Context-aware modal popup to inspect upstream step outputs.
- Inserts dynamic tags like `{{ prev.Name of Student }}` or `{{ n2.Temperature }}` into any input field with single-click precision.

### 📊 3. Smart CSV Generator & Dynamic Data Mapper
- **Nested Array Auto-Discovery**: Automatically extracts data rows from complex API output objects (e.g. `{ records: [...] }`, `{ data: [...] }`).
- **⚡ Auto-Detect Columns**: Parses upstream step schema and auto-populates CSV header and value expressions.
- **Custom Column Builder**: Allows adding, editing, or reordering headers and variable mappings.

### 🌐 4. HTTP Node & Google Apps Script Support
- **Redirect Handling**: Handles `302` redirects automatically (ideal for Google Apps Script Web Apps).
- **Query Parameter Builder**: Visual Key-Value table for URL parameters (`sheetuser=23012011002`, `action=get`, etc.).

### 🧪 5. Live Per-Step Testing
- Execute individual workflow nodes on demand to inspect live raw JSON responses before saving or running full flows.

### 🤖 6. AI-Powered Workflow Generation
- Describe workflows in plain English (e.g., *"Fetch weather from IMD API every morning and generate CSV report"*) to auto-generate node graphs via **Google Gemini AI**.

### ⏱️ 7. Scheduled Automation & Execution Logs
- Cron-based schedule runner (`node-cron`) for hands-off periodic executions.
- Comprehensive execution history with step-by-step output logs and status tracking.

---

## 🛠️ Technology Stack

| Component | Technologies Used |
|:---|:---|
| **Frontend** | React 18, Vite, ReactFlow, Lucide Icons, Zustand, Axios, React Hot Toast |
| **Backend** | Node.js, Express.js, MongoDB Atlas (Mongoose), Node-Cron, Axios, Google Generative AI |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs |

---

## 📂 Project Architecture

```
logicbridge/
├── backend/
│   ├── exports/             # Directory for generated CSV files
│   └── src/
│       ├── models/          # User, Workflow, Execution Mongoose schemas
│       ├── routes/          # auth, workflows, executions API endpoints
│       ├── middleware/      # JWT authentication middleware
│       └── services/        # workflowEngine (CSV/HTTP/Logic), scheduler, aiGenerator
└── frontend/
    └── src/
        ├── api/             # Axios client configuration
        ├── components/      # StepEditorSidebar, VariablePicker, ExecutionPanel, TemplatesModal
        ├── data/            # Pre-built workflow templates & node definitions
        ├── pages/           # Landing, Login, Register, Dashboard, Builder, Logs
        └── store/           # authStore, workflowStore (Zustand state)
```

---

## ⚡ Quick Start & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas URL or Local MongoDB instance

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file inside `/backend`:
```env
PORT=3001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
```
Start backend server:
```bash
npm run dev
# Server running on http://localhost:3001
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env` file inside `/frontend`:
```env
VITE_API_URL=http://localhost:3001
```
Start frontend app:
```bash
npm run dev
# App running on http://localhost:5173
```

---

## 📝 Pre-built Workflow Templates
1. **Student Attendance → CSV Report**: Fetches live student records from Google Apps Script API and outputs a formatted CSV file (`Enrollment No`, `Student Name`, `Team ID`, `Attendance Rate`).
2. **IMD Weather → CSV (Daily 8 AM)**: Connects to India Meteorological Department API and saves weather data automatically every morning.
3. **Multi-Step API Pipelines**: Delay actions, JSON transformers, conditional logic branching (`If / Else`), and loggers.

---

## 📄 License
Developed for Minor Project **MP_022**. All rights reserved.
