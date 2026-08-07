# Backend Services Layer

This directory contains business logic and database access functions for the LogicBridge API.

## Core Modules
- **`userService.js`**: User registration, authentication, and profile lookups.
- **`workflowService.js`**: Workflow CRUD, schedule cron registration, and deletion cascades.
- **`executionService.js`**: Execution history querying and statistics generation.
- **`workflowEngine.js`**: Graph topological sorting and sequential step execution engine.
- **`scheduler.js`**: `node-cron` schedule manager.
- **`aiGenerator.js`**: Gemini AI prompt generator for workflows.
