# Backend Controllers Layer

This directory contains Express controller handlers that process HTTP request payloads and return standardized JSON responses.

## Responsibilities
- Process Express `req.body`, `req.params`, and `req.headers`.
- Execute request payload validation.
- Delegate data operations to domain services (`userService`, `workflowService`, `executionService`).
- Return formatted responses via `ResponseHelper` (`success`, `error`).

## Directives
- **Zero Mongoose model imports**. All database queries belong in `services/`.
- Forward unexpected errors to Express `next(err)`.
