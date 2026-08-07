# Backend Utilities Layer

This directory contains reusable helper utilities used across the backend engine and node handlers.

## Modules
- **`VariableResolver.js`**: Handlebar template placeholder resolver (`resolveVariable`).
- **`CsvGenerator.js`**: Smart CSV content generator (`generateFile`).
- **`TemplateResolver.js`**: JSON template transform resolver (`transformTemplate`).
- **`ExecutionLogger.js`**: Contextual execution logger (`logExecution`, `logError`).
- **`ExecutionContext.js`**: Workflow execution runtime state class.
- **`ResponseHelper.js`**: Express HTTP response utility (`success`, `error`).
