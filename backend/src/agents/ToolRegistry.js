const { ConfigurationError } = require('../errors');
const nodeRegistry = require('../nodes/registry');

/**
 * Validates arguments against a simple JSON schema
 */
function validateSchema(schema, data) {
  if (!schema || typeof schema !== 'object') return { valid: true };
  if (schema.type === 'object') {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { valid: false, error: 'Expected an object' };
    }
    if (Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          return { valid: false, error: `Missing required field: "${field}"` };
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined && propSchema.enum) {
          if (!propSchema.enum.includes(data[key])) {
            return {
              valid: false,
              error: `Invalid value for "${key}". Allowed: ${propSchema.enum.join(', ')}`,
            };
          }
        }
      }
    }
  }
  return { valid: true };
}

/**
 * ToolRegistry — Manages tools available to AI Agents
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerDefaultTools();
  }

  /**
   * Registers a tool definition
   * @param {object} tool
   */
  registerTool(tool) {
    if (!tool || !tool.name || typeof tool.name !== 'string') {
      throw new ConfigurationError('Tool registration requires a string name');
    }
    if (!tool.description || typeof tool.description !== 'string') {
      throw new ConfigurationError(`Tool "${tool.name}" requires a description`);
    }
    if (!tool.handler || typeof tool.handler !== 'function') {
      throw new ConfigurationError(`Tool "${tool.name}" requires an execution handler function`);
    }

    this.tools.set(tool.name.toLowerCase().trim(), {
      name: tool.name.toLowerCase().trim(),
      description: tool.description,
      parameters: tool.parameters || { type: 'object', properties: {} },
      category: tool.category || 'utility',
      sensitive: Boolean(tool.sensitive),
      isSensitiveOperation: tool.isSensitiveOperation || null,
      handler: tool.handler,
    });
  }

  /**
   * Checks if tool exists
   * @param {string} name
   * @returns {boolean}
   */
  hasTool(name) {
    if (!name) return false;
    return this.tools.has(String(name).toLowerCase().trim());
  }

  /**
   * Returns a registered tool
   * @param {string} name
   * @returns {object|null}
   */
  getTool(name) {
    if (!name) return null;
    return this.tools.get(String(name).toLowerCase().trim()) || null;
  }

  /**
   * Validates arguments for a tool
   * @param {string} name
   * @param {object} args
   * @returns {{ valid: boolean, error?: string }}
   */
  validateToolArgs(name, args) {
    const tool = this.getTool(name);
    if (!tool) {
      return { valid: false, error: `Unknown tool "${name}"` };
    }
    return validateSchema(tool.parameters, args);
  }

  /**
   * Lists all available tool metadata (omits raw handlers)
   * @returns {Array<object>}
   */
  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      category: t.category,
      sensitive: t.sensitive,
    }));
  }

  /**
   * Returns tools matching an allowlist of tool names
   * @param {Array<string>} allowlist
   * @returns {Array<object>}
   */
  getToolsForAgent(allowlist = []) {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return [];
    }
    const normalized = new Set(allowlist.map((n) => String(n).toLowerCase().trim()));
    return Array.from(this.tools.values()).filter((t) => normalized.has(t.name));
  }

  _registerDefaultTools() {
    // 1. HTTP Request Tool
    this.registerTool({
      name: 'http_request',
      description: 'Execute an HTTP request (GET, POST, PUT, DELETE, PATCH) to an external URL or API endpoint',
      category: 'network',
      sensitive: false,
      isSensitiveOperation: (args) => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(String(args?.method || '').toUpperCase()),
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
          headers: { type: 'object' },
          body: { type: 'object' },
          queryParams: { type: 'object' },
        },
        required: ['url'],
      },
      handler: async (args, context) => {
        const httpHandler = nodeRegistry.get('action-http');
        if (!httpHandler) throw new Error('HTTP node handler not found');
        return httpHandler.execute(
          {
            id: 'tool_http',
            data: {
              url: args.url,
              method: args.method || 'GET',
              headersList: args.headers ? Object.entries(args.headers).map(([k, v]) => ({ key: k, value: String(v) })) : [],
              queryParamsList: args.queryParams ? Object.entries(args.queryParams).map(([k, v]) => ({ key: k, value: String(v) })) : [],
              body: args.body ? JSON.stringify(args.body) : '',
              timeout: 15000,
            },
          },
          context
        );
      },
    });

    // 2. Data Transformation Tool
    this.registerTool({
      name: 'transform_data',
      description: 'Transform, map, filter, or restructure an input object or array',
      category: 'data',
      sensitive: false,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['map', 'filter', 'extract', 'pick'] },
          input: { type: 'object' },
          fields: { type: 'array' },
        },
        required: ['input'],
      },
      handler: async (args, context) => {
        const transformHandler = nodeRegistry.get('action-transform');
        if (!transformHandler) throw new Error('Transform node handler not found');
        return transformHandler.execute(
          {
            id: 'tool_transform',
            data: {
              operation: args.operation || 'map',
              source: typeof args.input === 'object' ? JSON.stringify(args.input) : String(args.input),
              fields: args.fields || [],
            },
          },
          context
        );
      },
    });

    // 3. JSON Utility Tool
    this.registerTool({
      name: 'json_utility',
      description: 'Manipulate JSON data: parse string, stringify object, get or set property by dot-notation path',
      category: 'utility',
      sensitive: false,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['parse', 'stringify', 'get', 'set', 'remove'] },
          input: {},
          path: { type: 'string' },
          value: {},
        },
        required: ['operation'],
      },
      handler: async (args, context) => {
        const jsonHandler = nodeRegistry.get('action-json');
        if (!jsonHandler) throw new Error('JSON node handler not found');
        return jsonHandler.execute(
          {
            id: 'tool_json',
            data: {
              operation: args.operation,
              input: typeof args.input === 'object' ? JSON.stringify(args.input) : String(args.input || ''),
              path: args.path || '',
              value: args.value !== undefined ? (typeof args.value === 'object' ? JSON.stringify(args.value) : String(args.value)) : '',
            },
          },
          context
        );
      },
    });

    // 4. Text Utility Tool
    this.registerTool({
      name: 'text_utility',
      description: 'Perform text transformations: uppercase, lowercase, trim, replace, split, substring, or search',
      category: 'utility',
      sensitive: false,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['uppercase', 'lowercase', 'trim', 'replace', 'split', 'substring', 'contains'] },
          input: { type: 'string' },
          find: { type: 'string' },
          replace: { type: 'string' },
          separator: { type: 'string' },
          start: { type: 'number' },
          end: { type: 'number' },
        },
        required: ['operation', 'input'],
      },
      handler: async (args, context) => {
        const textHandler = nodeRegistry.get('action-text');
        if (!textHandler) throw new Error('Text node handler not found');
        return textHandler.execute(
          {
            id: 'tool_text',
            data: {
              operation: args.operation,
              input: args.input,
              find: args.find || '',
              replace: args.replace || '',
              separator: args.separator || ',',
              start: String(args.start ?? 0),
              end: args.end !== undefined ? String(args.end) : '',
            },
          },
          context
        );
      },
    });

    // 5. Math Utility Tool
    this.registerTool({
      name: 'math_utility',
      description: 'Perform mathematical operations: add, subtract, multiply, divide, round, abs, min, max, power',
      category: 'utility',
      sensitive: false,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide', 'round', 'abs', 'min', 'max', 'power'] },
          valueA: { type: 'number' },
          valueB: { type: 'number' },
        },
        required: ['operation'],
      },
      handler: async (args, context) => {
        const mathHandler = nodeRegistry.get('action-math');
        if (!mathHandler) throw new Error('Math node handler not found');
        return mathHandler.execute(
          {
            id: 'tool_math',
            data: {
              operation: args.operation,
              valueA: String(args.valueA ?? ''),
              valueB: String(args.valueB ?? ''),
            },
          },
          context
        );
      },
    });

    // 6. Date Utility Tool
    this.registerTool({
      name: 'date_utility',
      description: 'Get current timestamp, format a date, calculate duration difference, or add/subtract time',
      category: 'utility',
      sensitive: false,
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['now', 'format', 'diff', 'add', 'subtract'] },
          dateInput: { type: 'string' },
          format: { type: 'string' },
          amount: { type: 'number' },
          unit: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days', 'months', 'years'] },
        },
        required: ['operation'],
      },
      handler: async (args, context) => {
        const dateHandler = nodeRegistry.get('action-date');
        if (!dateHandler) throw new Error('Date node handler not found');
        return dateHandler.execute(
          {
            id: 'tool_date',
            data: {
              operation: args.operation,
              dateInput: args.dateInput || '',
              dateFormat: args.format || 'YYYY-MM-DD',
              amount: String(args.amount ?? 1),
              unit: args.unit || 'days',
            },
          },
          context
        );
      },
    });

    // 7. Database Query Tool
    this.registerTool({
      name: 'database_query',
      description: 'Query PostgreSQL or MongoDB using configured connection. Insert/update/delete operations are sensitive.',
      category: 'database',
      sensitive: false,
      isSensitiveOperation: (args) => ['insert', 'update', 'delete', 'drop'].includes(String(args?.operation || '').toLowerCase()),
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['postgres', 'mongodb'] },
          connectionId: { type: 'string' },
          operation: { type: 'string' },
          query: { type: 'string' },
          table: { type: 'string' },
          collection: { type: 'string' },
          filter: { type: 'object' },
          limit: { type: 'number' },
        },
        required: ['type', 'connectionId', 'operation'],
      },
      handler: async (args, context) => {
        const nodeType = args.type === 'mongodb' ? 'action-mongodb' : 'action-postgres';
        const dbHandler = nodeRegistry.get(nodeType);
        if (!dbHandler) throw new Error(`Database handler for "${args.type}" not found`);
        return dbHandler.execute(
          {
            id: 'tool_database',
            data: {
              connectionId: args.connectionId,
              operation: args.operation,
              query: args.query || '',
              table: args.table || '',
              collection: args.collection || '',
              filter: args.filter ? JSON.stringify(args.filter) : '',
              limit: String(args.limit || 10),
            },
          },
          context
        );
      },
    });

    // 8. Google Sheets Tool
    this.registerTool({
      name: 'google_sheets',
      description: 'Read or append rows in Google Sheets spreadsheet. Row modification is sensitive.',
      category: 'database',
      sensitive: false,
      isSensitiveOperation: (args) => ['append_row', 'update_row', 'delete_row'].includes(String(args?.operation || '').toLowerCase()),
      parameters: {
        type: 'object',
        properties: {
          connectionId: { type: 'string' },
          spreadsheet: { type: 'string' },
          sheet: { type: 'string' },
          operation: { type: 'string', enum: ['get_rows', 'append_row', 'update_row', 'find_row'] },
          rowNumber: { type: 'number' },
          row: { type: 'object' },
        },
        required: ['connectionId', 'spreadsheet', 'operation'],
      },
      handler: async (args, context) => {
        const sheetsHandler = nodeRegistry.get('action-google-sheets');
        if (!sheetsHandler) throw new Error('Google Sheets handler not found');
        return sheetsHandler.execute(
          {
            id: 'tool_sheets',
            data: {
              connectionId: args.connectionId,
              spreadsheet: args.spreadsheet,
              sheet: args.sheet || 'Sheet1',
              operation: args.operation,
              rowNumber: args.rowNumber ? String(args.rowNumber) : '',
              row: args.row ? JSON.stringify(args.row) : '',
            },
          },
          context
        );
      },
    });

    // 9. Slack Message Tool
    this.registerTool({
      name: 'slack_message',
      description: 'Send a message or query a channel in Slack. Sending messages is sensitive.',
      category: 'communication',
      sensitive: true,
      parameters: {
        type: 'object',
        properties: {
          connectionId: { type: 'string' },
          operation: { type: 'string', enum: ['send_message', 'send_dm', 'get_channel'] },
          channel: { type: 'string' },
          text: { type: 'string' },
          userId: { type: 'string' },
        },
        required: ['operation'],
      },
      handler: async (args, context) => {
        const slackHandler = nodeRegistry.get('action-slack');
        if (!slackHandler) throw new Error('Slack handler not found');
        return slackHandler.execute(
          {
            id: 'tool_slack',
            data: {
              connectionId: args.connectionId,
              operation: args.operation,
              channel: args.channel || '',
              text: args.text || '',
              userId: args.userId || '',
            },
          },
          context
        );
      },
    });

    // 10. Discord Message Tool
    this.registerTool({
      name: 'discord_message',
      description: 'Send a message to a Discord channel. Sending messages is sensitive.',
      category: 'communication',
      sensitive: true,
      parameters: {
        type: 'object',
        properties: {
          connectionId: { type: 'string' },
          channelId: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['content'],
      },
      handler: async (args, context) => {
        const discordHandler = nodeRegistry.get('action-discord');
        if (!discordHandler) throw new Error('Discord handler not found');
        return discordHandler.execute(
          {
            id: 'tool_discord',
            data: {
              connectionId: args.connectionId,
              channelId: args.channelId || '',
              content: args.content,
            },
          },
          context
        );
      },
    });

    // 11. File Storage Tool
    this.registerTool({
      name: 'file_storage',
      description: 'Read or list files within the isolated user workspace sandbox. Write operations are sensitive.',
      category: 'storage',
      sensitive: false,
      isSensitiveOperation: (args) => ['write_file', 'delete_file'].includes(String(args?.operation || '').toLowerCase()),
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['read_file', 'write_file', 'list_files'] },
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['operation', 'path'],
      },
      handler: async (args, context) => {
        const fileHandler = nodeRegistry.get('action-file');
        if (!fileHandler) throw new Error('File handler not found');
        return fileHandler.execute(
          {
            id: 'tool_file',
            data: {
              operation: args.operation,
              path: args.path,
              content: args.content || '',
            },
          },
          context
        );
      },
    });
  }
}

// Export singleton instance
const toolRegistry = new ToolRegistry();

module.exports = {
  ToolRegistry,
  toolRegistry,
};
