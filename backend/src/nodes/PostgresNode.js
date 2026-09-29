const { Client } = require('pg');
const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const { connectionRegistry } = require('../providers/connections');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * Validates a SQL identifier (table, schema, column) to prevent SQL injection.
 * Safe identifiers: alphanumeric and underscore, optionally dot-separated for schema.table.
 */
function validateIdentifier(identifier, fieldName = 'Identifier') {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error(`${fieldName} must be a valid non-empty string`);
  }
  const trimmed = identifier.trim();
  const parts = trimmed.split('.');
  for (const part of parts) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part)) {
      throw new Error(`Invalid ${fieldName}: "${trimmed}". Only alphanumeric characters and underscores are permitted.`);
    }
  }
  return parts.map((p) => `"${p}"`).join('.');
}

/**
 * Parses and resolves variable expressions in an object or JSON string
 */
function resolveJsonOrObject(value, context) {
  if (!value) return null;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (typeof item === 'string') {
          const res = resolveVariable(item, context);
          try {
            return JSON.parse(res);
          } catch {
            return res;
          }
        }
        return item;
      });
    }
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') {
        const res = resolveVariable(v, context);
        // Try parsing JSON if it was an object/array serialized
        try {
          resolved[k] = JSON.parse(res);
        } catch {
          resolved[k] = res;
        }
      } else {
        resolved[k] = v;
      }
    }
    return resolved;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const resolvedStr = resolveVariable(trimmed, context);
    try {
      return JSON.parse(resolvedStr);
    } catch {
      // If not JSON, return as-is
      return resolvedStr;
    }
  }

  return value;
}

class PostgresNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_POSTGRES,
      name: 'PostgreSQL',
      category: 'action',
      icon: '🐘',
      description: 'Execute queries, inserts, updates, and deletes on a PostgreSQL database',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    const { connectionId, operation = 'select', table, query, sql, values, filters } = data;

    if (!connectionId || !String(connectionId).trim()) {
      return { valid: false, error: 'PostgreSQL connection is required' };
    }

    const validOps = ['select', 'insert', 'update', 'delete', 'query'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${operation}". Supported: ${validOps.join(', ')}` };
    }

    if (operation === 'query') {
      const sqlQuery = query || sql;
      if (!sqlQuery || !String(sqlQuery).trim()) {
        return { valid: false, error: 'SQL query is required for Raw SQL operation' };
      }
    } else {
      if (!table || !String(table).trim()) {
        return { valid: false, error: `Table name is required for "${operation}" operation` };
      }

      if (operation === 'insert') {
        if (!values || (typeof values === 'object' && Object.keys(values).length === 0)) {
          return { valid: false, error: 'Values / data are required for insert operation' };
        }
      }

      if (operation === 'update') {
        if (!values || (typeof values === 'object' && Object.keys(values).length === 0)) {
          return { valid: false, error: 'Values / data are required for update operation' };
        }
        if (!filters || (typeof filters === 'object' && Object.keys(filters).length === 0)) {
          return { valid: false, error: 'Filters / WHERE condition is required for update operation' };
        }
      }

      if (operation === 'delete') {
        if (!filters || (typeof filters === 'object' && Object.keys(filters).length === 0)) {
          return { valid: false, error: 'Filters / WHERE condition is required for delete operation' };
        }
      }
    }

    return { valid: true };
  }

  createClient(credentials) {
    const provider = connectionRegistry.resolve('postgres');
    const config = provider.getClientConfig(credentials);
    return new Client(config);
  }

  async execute(node, context) {
    const data = node?.data || {};
    const {
      connectionId,
      operation = 'select',
      table,
      columns = '*',
      filters,
      where,
      values,
      limit,
      query,
      sql,
      params,
    } = data;

    const validation = this.validate(node);
    if (!validation.valid) {
      throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });
    }

    // 1. Decrypt connection credentials
    const ownerId = context?.ownerId || context?.userId || context?.user?._id || context?.user?.id || 'system';
    let credentials;
    try {
      credentials = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
    } catch (err) {
      const sanitized = (err.message || 'Connection error')
        .replace(/password=([^\s]+)/gi, 'password=[REDACTED]')
        .replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@');
      throw new NodeExecutionError(`Failed to retrieve database connection: ${sanitized}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    }

    // 2. Prepare parameterized query
    let queryText = '';
    const queryParams = [];

    try {
      if (operation === 'query') {
        let rawSql = String(query || sql || '').trim();

        // Parameter handling: resolve user-supplied params array
        let initialParams = [];
        if (params) {
          const parsedParams = resolveJsonOrObject(params, context);
          if (Array.isArray(parsedParams)) {
            initialParams = parsedParams.map((p) =>
              typeof p === 'string' ? resolveVariable(p, context) : p
            );
          }
        }

        // If rawSql contains mustache syntax {{...}}, extract and safely parameterize
        if (rawSql.includes('{{')) {
          let paramIdx = initialParams.length;
          queryText = rawSql.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
            paramIdx++;
            const resolvedVal = resolveVariable(`{{${expr}}}`, context);
            initialParams.push(resolvedVal);
            return `$${paramIdx}`;
          });
        } else {
          queryText = rawSql;
        }

        queryParams.push(...initialParams);
      } else {
        const safeTable = validateIdentifier(table, 'Table name');

        if (operation === 'select') {
          // Columns
          let colsClause = '*';
          if (columns && columns !== '*') {
            if (Array.isArray(columns)) {
              colsClause = columns.map((c) => validateIdentifier(String(c), 'Column')).join(', ');
            } else if (typeof columns === 'string') {
              const colList = resolveVariable(columns, context).split(',').map((c) => c.trim()).filter(Boolean);
              colsClause = colList.map((c) => validateIdentifier(c, 'Column')).join(', ');
            }
          }

          queryText = `SELECT ${colsClause} FROM ${safeTable}`;

          // Filters / WHERE
          const filterObj = resolveJsonOrObject(filters || where, context);
          if (filterObj && typeof filterObj === 'object' && Object.keys(filterObj).length > 0) {
            const whereClauses = [];
            for (const [col, val] of Object.entries(filterObj)) {
              const safeCol = validateIdentifier(col, 'Filter column');
              queryParams.push(val);
              whereClauses.push(`${safeCol} = $${queryParams.length}`);
            }
            queryText += ` WHERE ${whereClauses.join(' AND ')}`;
          }

          // Limit
          if (limit !== undefined && limit !== null && String(limit).trim() !== '') {
            const resolvedLimit = resolveVariable(String(limit), context);
            const limitNum = parseInt(resolvedLimit, 10);
            if (!isNaN(limitNum) && limitNum >= 0) {
              queryParams.push(limitNum);
              queryText += ` LIMIT $${queryParams.length}`;
            }
          }
        } else if (operation === 'insert') {
          const valueObj = resolveJsonOrObject(values || data.data, context);
          if (!valueObj || typeof valueObj !== 'object' || Object.keys(valueObj).length === 0) {
            throw new Error('Insert requires at least one field-value pair');
          }

          const cols = [];
          const placeholders = [];
          for (const [col, val] of Object.entries(valueObj)) {
            cols.push(validateIdentifier(col, 'Insert column'));
            queryParams.push(val);
            placeholders.push(`$${queryParams.length}`);
          }

          queryText = `INSERT INTO ${safeTable} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        } else if (operation === 'update') {
          const valueObj = resolveJsonOrObject(values || data.data, context);
          if (!valueObj || typeof valueObj !== 'object' || Object.keys(valueObj).length === 0) {
            throw new Error('Update requires at least one field-value pair in values');
          }

          const setClauses = [];
          for (const [col, val] of Object.entries(valueObj)) {
            const safeCol = validateIdentifier(col, 'Update column');
            queryParams.push(val);
            setClauses.push(`${safeCol} = $${queryParams.length}`);
          }

          const filterObj = resolveJsonOrObject(filters || where, context);
          if (!filterObj || typeof filterObj !== 'object' || Object.keys(filterObj).length === 0) {
            throw new Error('Update requires at least one condition in filters to avoid accidental full table update');
          }

          const whereClauses = [];
          for (const [col, val] of Object.entries(filterObj)) {
            const safeCol = validateIdentifier(col, 'Filter column');
            queryParams.push(val);
            whereClauses.push(`${safeCol} = $${queryParams.length}`);
          }

          queryText = `UPDATE ${safeTable} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *`;
        } else if (operation === 'delete') {
          const filterObj = resolveJsonOrObject(filters || where, context);
          if (!filterObj || typeof filterObj !== 'object' || Object.keys(filterObj).length === 0) {
            throw new Error('Delete requires at least one condition in filters to avoid accidental full table deletion');
          }

          const whereClauses = [];
          for (const [col, val] of Object.entries(filterObj)) {
            const safeCol = validateIdentifier(col, 'Filter column');
            queryParams.push(val);
            whereClauses.push(`${safeCol} = $${queryParams.length}`);
          }

          queryText = `DELETE FROM ${safeTable} WHERE ${whereClauses.join(' AND ')} RETURNING *`;
        }
      }
    } catch (err) {
      throw new NodeExecutionError(`PostgreSQL query preparation error: ${err.message}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    }

    // 3. Execute query with client
    const client = context?._pgClient || this._clientOverride || this.createClient(credentials);
    const shouldClose = !context?._pgClient && !this._clientOverride;

    try {
      if (shouldClose) {
        await client.connect();
      }

      const result = await client.query(queryText, queryParams);
      const rows = result?.rows || [];
      const rowCount = result?.rowCount ?? rows.length;

      return {
        rows,
        rowCount,
        operation,
        data: rows,
      };
    } catch (err) {
      const sanitizedError = (err.message || 'Database error')
        .replace(/password=([^\s]+)/gi, 'password=[REDACTED]')
        .replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@');

      throw new NodeExecutionError(`PostgreSQL execution error: ${sanitizedError}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    } finally {
      if (shouldClose) {
        await client.end().catch(() => {});
      }
    }
  }
}

module.exports = PostgresNode;
