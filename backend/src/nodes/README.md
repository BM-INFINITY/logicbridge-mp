# Backend Node Registry & Handlers

This directory contains the modular node execution handler classes for LogicBridge workflows.

## Architecture & Responsibilities
- **`BaseNode.js`**: Abstract base class defining `metadata()`, `validate(node)`, and `execute(node, context)`.
- **`registry.js`**: Singleton registry instance managing registered node class handlers.
- **`index.js`**: Auto-registration barrel exporting `registry` and all default node classes.

## Extension Guidelines
To add a new workflow step type:
1. Create a new subclass file in this folder (e.g. `MyCustomNode.js`) inheriting from `BaseNode`.
2. Implement `metadata()`, `validate(node)`, and `execute(node, context)`.
3. Register the class instance in `index.js`.
