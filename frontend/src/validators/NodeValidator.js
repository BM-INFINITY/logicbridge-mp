import { NodeTypes } from '../constants/NodeTypes.js';

/**
 * Frontend validation rules for step configuration and branch connection logic
 */
export class NodeValidator {
  /**
   * Validates a node's data payload before testing or execution
   * @param {object} node - React Flow node object
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateNode(node) {
    if (!node) return { valid: false, error: 'No step selected' };
    const { type, data } = node;

    if (type === NodeTypes.ACTION_HTTP) {
      if (!data?.url || !data.url.trim()) {
        return { valid: false, error: 'HTTP URL is required' };
      }
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      if (data?.method && !validMethods.includes(String(data.method).toUpperCase())) {
        return { valid: false, error: `Invalid HTTP method "${data.method}"` };
      }
      if (data?.authType === 'bearer' && !data.authToken?.trim()) {
        return { valid: false, error: 'Bearer Token is required when Bearer Auth is selected' };
      }
      if (data?.authType === 'api_key' && (!data.apiKey?.trim() || !data.apiValue?.trim())) {
        return { valid: false, error: 'API Key name and value are required when API Key Auth is selected' };
      }
      if (data?.authType === 'basic' && (!data.authUsername?.trim() || !data.authPassword?.trim())) {
        return { valid: false, error: 'Username and password are required when Basic Auth is selected' };
      }
      if (data?.authType === 'connection' && !data.connectionId) {
        return { valid: false, error: 'Saved Connection must be selected when Connection Auth is chosen' };
      }
      if (data?.contentType === 'json' && data?.body && typeof data.body === 'string' && !data.body.includes('{{')) {
        try {
          JSON.parse(data.body);
        } catch {
          return { valid: false, error: 'Transform body template must be valid JSON' };
        }
      }
      if (data?.timeout !== undefined && (isNaN(Number(data.timeout)) || Number(data.timeout) < 100 || Number(data.timeout) > 300000)) {
        return { valid: false, error: 'Timeout must be between 100ms and 300,000ms' };
      }
      if (data?.retries !== undefined && (isNaN(Number(data.retries)) || Number(data.retries) < 0 || Number(data.retries) > 5)) {
        return { valid: false, error: 'Retries must be an integer between 0 and 5' };
      }
    }

    if (type === NodeTypes.ACTION_CSV) {
      if (!data?.columns || (Array.isArray(data.columns) && data.columns.length === 0)) {
        return { valid: false, error: 'At least one CSV column definition is required' };
      }
    }

    if (type === NodeTypes.ACTION_TRANSFORM) {
      const validOps = ['map', 'pick', 'omit', 'set', 'remove', 'array-map', 'array-filter', 'array-find', 'array-first', 'array-last', 'array-length'];
      const op = data?.operation || 'map';
      if (!validOps.includes(op)) {
        return { valid: false, error: `Unsupported transform operation "${op}"` };
      }
      if (['map', 'set', 'array-map'].includes(op)) {
        const mappings = data?.mappings || [];
        const valid = mappings.some((m) => m.outputField && String(m.outputField).trim());
        if (!valid) {
          return { valid: false, error: `Transform "${op}" requires at least one field mapping` };
        }
      }
      if (['pick', 'omit', 'remove'].includes(op)) {
        const fields = data?.fields || [];
        if (!fields.some((f) => f && String(f).trim())) {
          return { valid: false, error: `Transform "${op}" requires at least one field name` };
        }
      }
      if (['array-filter', 'array-find'].includes(op) && !data?.filterField?.trim()) {
        return { valid: false, error: `Transform "${op}" requires a filter field name` };
      }
    }

    if (type === NodeTypes.ACTION_JSON) {
      const validJsonOps = ['parse', 'stringify', 'get', 'set', 'remove'];
      const op = data?.operation;
      if (!op || !validJsonOps.includes(op)) {
        return { valid: false, error: 'JSON operation is required' };
      }
      if (op === 'parse' && !data?.input?.trim()) {
        return { valid: false, error: 'JSON "parse" requires an input value' };
      }
      if ((op === 'get' || op === 'set' || op === 'remove') && !data?.path?.trim()) {
        return { valid: false, error: `JSON "${op}" requires a property path` };
      }
    }

    if (type === NodeTypes.ACTION_TEXT) {
      const validTextOps = ['uppercase', 'lowercase', 'trim', 'replace', 'contains', 'startsWith', 'endsWith', 'split', 'join', 'length', 'substring'];
      const op = data?.operation;
      if (!op || !validTextOps.includes(op)) {
        return { valid: false, error: 'Text operation is required' };
      }
      if (!data?.input?.trim()) {
        return { valid: false, error: `Text "${op}" requires an input value` };
      }
      if (op === 'replace' && !String(data?.find ?? '')) {
        return { valid: false, error: 'Text "replace" requires a Find value' };
      }
      if ((op === 'contains' || op === 'startsWith' || op === 'endsWith') && data?.search === undefined) {
        return { valid: false, error: `Text "${op}" requires a search value` };
      }
    }

    if (type === NodeTypes.ACTION_MATH) {
      const unaryOps = ['round', 'floor', 'ceil', 'absolute'];
      const binaryOps = ['add', 'subtract', 'multiply', 'divide', 'modulo', 'min', 'max', 'percentage'];
      const allOps = [...unaryOps, ...binaryOps];
      const op = data?.operation;
      if (!op || !allOps.includes(op)) {
        return { valid: false, error: 'Math operation is required' };
      }
      if (!data?.valueA?.trim()) {
        return { valid: false, error: `Math "${op}" requires Value A` };
      }
      if (binaryOps.includes(op) && !data?.valueB?.trim()) {
        return { valid: false, error: `Math "${op}" requires Value B` };
      }
    }

    if (type === NodeTypes.ACTION_DATE) {
      const validDateOps = ['now', 'parse', 'format', 'add', 'subtract', 'compare', 'difference'];
      const op = data?.operation;
      if (!op || !validDateOps.includes(op)) {
        return { valid: false, error: 'Date operation is required' };
      }
      const needsInput = ['parse', 'format', 'add', 'subtract'];
      if (needsInput.includes(op) && !data?.dateInput?.trim()) {
        return { valid: false, error: `Date "${op}" requires a date input value` };
      }
      if ((op === 'add' || op === 'subtract') && !data?.amount?.trim()) {
        return { valid: false, error: `Date "${op}" requires an amount` };
      }
      if ((op === 'compare' || op === 'difference') && (!data?.dateA?.trim() || !data?.dateB?.trim())) {
        return { valid: false, error: `Date "${op}" requires both Date A and Date B` };
      }
    }

    if (type === NodeTypes.ACTION_POSTGRES) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'PostgreSQL connection is required' };
      }
      const validPgOps = ['select', 'insert', 'update', 'delete', 'query'];
      const op = data?.operation || 'select';
      if (!validPgOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${op}". Supported: ${validPgOps.join(', ')}` };
      }
      if (op === 'query') {
        const sqlQuery = data?.query || data?.sql;
        if (!sqlQuery || !String(sqlQuery).trim()) {
          return { valid: false, error: 'SQL query is required for Raw SQL operation' };
        }
      } else {
        if (!data?.table?.trim()) {
          return { valid: false, error: `Table name is required for "${op}" operation` };
        }
        if (op === 'insert') {
          const val = data?.values ?? data?.data;
          const hasVal = typeof val === 'object' ? val && Object.keys(val).length > 0 : String(val || '').trim();
          if (!hasVal) {
            return { valid: false, error: 'Values / data are required for insert operation' };
          }
        }
        if (op === 'update') {
          const val = data?.values ?? data?.data;
          const hasVal = typeof val === 'object' ? val && Object.keys(val).length > 0 : String(val || '').trim();
          const filter = data?.filters ?? data?.where;
          const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
          if (!hasVal) {
            return { valid: false, error: 'Values / data are required for update operation' };
          }
          if (!hasFilter) {
            return { valid: false, error: 'Filters / WHERE condition is required for update operation' };
          }
        }
        if (op === 'delete') {
          const filter = data?.filters ?? data?.where;
          const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
          if (!hasFilter) {
            return { valid: false, error: 'Filters / WHERE condition is required for delete operation' };
          }
        }
      }
    }

    if (type === NodeTypes.ACTION_MONGODB) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'MongoDB connection is required' };
      }
      const validMongoOps = ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'deleteOne', 'count'];
      const op = data?.operation || 'find';
      if (!validMongoOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${op}". Supported: ${validMongoOps.join(', ')}` };
      }
      if (!data?.collection?.trim()) {
        return { valid: false, error: 'Collection name is required' };
      }
      if (op === 'insertOne') {
        const doc = data?.document ?? data?.data;
        const hasDoc = typeof doc === 'object' ? doc && Object.keys(doc).length > 0 : String(doc || '').trim();
        if (!hasDoc) {
          return { valid: false, error: 'Document data is required for insertOne' };
        }
      }
      if (op === 'insertMany') {
        const docs = data?.document ?? data?.data;
        const hasDocs = Array.isArray(docs) ? docs.length > 0 : String(docs || '').trim();
        if (!hasDocs) {
          return { valid: false, error: 'Documents array is required for insertMany' };
        }
      }
      if (op === 'updateOne') {
        const upd = data?.update ?? data?.document ?? data?.data;
        const hasUpd = typeof upd === 'object' ? upd && Object.keys(upd).length > 0 : String(upd || '').trim();
        const filter = data?.filter;
        const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
        if (!hasUpd) {
          return { valid: false, error: 'Update data is required for updateOne' };
        }
        if (!hasFilter) {
          return { valid: false, error: 'Filter is required for updateOne' };
        }
      }
      if (op === 'deleteOne') {
        const filter = data?.filter;
        const hasFilter = typeof filter === 'object' ? filter && Object.keys(filter).length > 0 : String(filter || '').trim();
        if (!hasFilter) {
          return { valid: false, error: 'Filter is required for deleteOne' };
        }
      }
    }

    if (type === NodeTypes.ACTION_GOOGLE_SHEETS) {
      if (!data?.connectionId?.trim()) {
        return { valid: false, error: 'Google Sheets connection is required' };
      }
      const targetSheet = data?.spreadsheet || data?.spreadsheetId;
      if (!targetSheet?.trim()) {
        return { valid: false, error: 'Spreadsheet ID or URL is required' };
      }
      const validOps = [
        'get_rows', 'getrows', 'get-rows',
        'get_row', 'getrow', 'get-row',
        'add_row', 'addrow', 'add-row', 'append',
        'update_row', 'updaterow', 'update-row',
        'delete_row', 'deleterow', 'delete-row',
        'find_row', 'findrow', 'find-row',
      ];
      const rawOp = data?.operation || 'get_rows';
      const opKey = String(rawOp).toLowerCase().replace(/[^a-z]/g, '');
      if (!validOps.map((o) => o.replace(/[^a-z]/g, '')).includes(opKey)) {
        return { valid: false, error: `Invalid operation "${rawOp}". Supported: Get Rows, Get Row, Add Row, Update Row, Delete Row, Find Row` };
      }
      if (opKey === 'getrow' || opKey === 'updaterow' || opKey === 'deleterow') {
        const rNum = data?.rowNumber;
        if (rNum === undefined || rNum === null || String(rNum).trim() === '') {
          return { valid: false, error: `Row number is required for ${rawOp} operation` };
        }
      }
      if (opKey === 'addrow' || opKey === 'append' || opKey === 'updaterow') {
        const val = data?.row ?? data?.values ?? data?.data;
        const hasVal = typeof val === 'object' ? (val && Object.keys(val).length > 0) : String(val || '').trim();
        if (!hasVal) {
          return { valid: false, error: `Row data/values are required for ${rawOp} operation` };
        }
      }
      if (opKey === 'findrow') {
        if (!data?.searchColumn?.trim()) {
          return { valid: false, error: 'Search column is required for Find Row operation' };
        }
        if (data?.searchValue === undefined || data?.searchValue === null || String(data?.searchValue).trim() === '') {
          return { valid: false, error: 'Search value is required for Find Row operation' };
        }
      }
    }

    if (type === NodeTypes.ACTION_SLACK) {
      const { connectionId, token } = data || {};
      if (!connectionId && !token) {
        return { valid: false, error: 'Slack connection is required' };
      }
      const validOps = ['send_message', 'send_dm', 'send_blocks', 'get_channel'];
      const rawOp = String(data?.operation || 'send_message').toLowerCase().trim().replace(/[-_\s]+/g, '_');
      const op = ['send_channel_message', 'post_message', 'message'].includes(rawOp)
        ? 'send_message'
        : ['direct_message', 'dm'].includes(rawOp)
        ? 'send_dm'
        : ['blocks', 'rich_message'].includes(rawOp)
        ? 'send_blocks'
        : ['channel_info', 'get_channel_info', 'channel'].includes(rawOp)
        ? 'get_channel'
        : rawOp;

      if (!validOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${data?.operation}". Supported: ${validOps.join(', ')}` };
      }

      if (op === 'send_message') {
        if (!data?.channel || !String(data.channel).trim()) {
          return { valid: false, error: 'Destination channel is required for Send Message' };
        }
        if (!data?.text && !data?.message) {
          return { valid: false, error: 'Message text is required for Send Message' };
        }
      }

      if (op === 'send_dm') {
        if (!data?.userId && !data?.user) {
          return { valid: false, error: 'User ID is required for Send Direct Message' };
        }
        if (!data?.text && !data?.message) {
          return { valid: false, error: 'Message text is required for Send Direct Message' };
        }
      }

      if (op === 'send_blocks') {
        if (!data?.channel || !String(data.channel).trim()) {
          return { valid: false, error: 'Destination channel is required for Send Blocks' };
        }
        if (!data?.blocks && !data?.text && !data?.message) {
          return { valid: false, error: 'Blocks or fallback text is required for Send Blocks' };
        }
      }

      if (op === 'get_channel') {
        if (!data?.channel && !data?.channelId) {
          return { valid: false, error: 'Channel ID is required for Get Channel Info' };
        }
      }
    }

    if (type === NodeTypes.ACTION_DISCORD) {
      const { connectionId, botToken, token, webhookUrl } = data || {};
      if (!connectionId && !botToken && !token && !webhookUrl) {
        return { valid: false, error: 'Discord connection, Bot Token, or Webhook URL is required' };
      }

      const validOps = ['send_message', 'send_embed', 'send_webhook', 'get_channel'];
      const rawOp = String(data?.operation || 'send_message').toLowerCase().trim().replace(/[-_\s]+/g, '_');
      const op = ['message', 'post_message', 'send_channel_message'].includes(rawOp)
        ? 'send_message'
        : ['embed', 'rich_embed'].includes(rawOp)
        ? 'send_embed'
        : ['webhook', 'send_message_using_webhook'].includes(rawOp)
        ? 'send_webhook'
        : ['channel_info', 'get_channel_info', 'channel'].includes(rawOp)
        ? 'get_channel'
        : rawOp;

      if (!validOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${data?.operation}". Supported: ${validOps.join(', ')}` };
      }

      if (op === 'send_message') {
        if (!data?.content && !data?.text && !data?.message) {
          return { valid: false, error: 'Message content is required for Send Message' };
        }
      }

      if (op === 'send_embed') {
        if (!data?.embed && !data?.embeds && !data?.title && !data?.description && !data?.content) {
          return { valid: false, error: 'Embed data or title/description is required for Send Embed' };
        }
      }

      if (op === 'send_webhook') {
        if (!webhookUrl && !connectionId) {
          return { valid: false, error: 'Webhook URL or Webhook Connection is required' };
        }
        if (!data?.content && !data?.embeds && !data?.embed) {
          return { valid: false, error: 'Content or embeds required for Send Webhook' };
        }
      }

      if (op === 'get_channel') {
        if (!data?.channelId && !data?.channel) {
          return { valid: false, error: 'Channel ID is required for Get Channel Info' };
        }
      }
    }

    if (type === NodeTypes.ACTION_FILE) {
      const validOps = ['read_file', 'write_file', 'create_file', 'delete_file', 'get_metadata', 'move_file'];
      const rawOp = String(data?.operation || 'read_file').toLowerCase().trim().replace(/[-_\s]+/g, '_');
      const op = ['read', 'load_file'].includes(rawOp)
        ? 'read_file'
        : ['write', 'save_file'].includes(rawOp)
        ? 'write_file'
        : ['create', 'touch_file', 'new_file'].includes(rawOp)
        ? 'create_file'
        : ['delete', 'remove_file', 'unlink'].includes(rawOp)
        ? 'delete_file'
        : ['metadata', 'stat', 'file_info'].includes(rawOp)
        ? 'get_metadata'
        : ['move', 'rename', 'rename_file'].includes(rawOp)
        ? 'move_file'
        : rawOp;

      if (!validOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${data?.operation}". Supported: ${validOps.join(', ')}` };
      }

      const filePath = data?.path || data?.filePath || data?.filename;

      if (op === 'move_file') {
        const src = data?.sourcePath || filePath;
        const dest = data?.destinationPath || data?.newPath;
        if (!src || !String(src).trim()) {
          return { valid: false, error: 'Source file path is required for Move / Rename' };
        }
        if (!dest || !String(dest).trim()) {
          return { valid: false, error: 'Destination file path is required for Move / Rename' };
        }
      } else {
        if (!filePath || !String(filePath).trim()) {
          return { valid: false, error: `File path or filename is required for ${op.replace('_', ' ')}` };
        }
      }

      if (op === 'write_file') {
        if (data?.content === undefined && data?.data === undefined && data?.text === undefined && !data?.sourceStep) {
          return { valid: false, error: 'Content is required for Write File' };
        }
      }
    }

    if (type === NodeTypes.ACTION_STORAGE) {
      const validOps = ['upload', 'download', 'list', 'delete', 'get_metadata'];
      const rawOp = String(data?.operation || 'upload').toLowerCase().trim().replace(/[-_\s]+/g, '_');
      const op = ['upload_file', 'put_file', 'put_object'].includes(rawOp)
        ? 'upload'
        : ['download_file', 'get_file', 'get_object'].includes(rawOp)
        ? 'download'
        : ['list_files', 'list_objects'].includes(rawOp)
        ? 'list'
        : ['delete_file', 'delete_object'].includes(rawOp)
        ? 'delete'
        : ['metadata', 'get_object_metadata', 'head_object', 'stat'].includes(rawOp)
        ? 'get_metadata'
        : rawOp;

      if (!validOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${data?.operation}". Supported: ${validOps.join(', ')}` };
      }

      const provider = String(data?.provider || 'local').toLowerCase().trim();
      if (provider === 'aws_s3' || provider === 's3') {
        const hasCreds = Boolean(data?.connectionId || (data?.accessKeyId && data?.secretAccessKey));
        if (!hasCreds) {
          return { valid: false, error: 'AWS S3 connection or Access Key credentials are required' };
        }
      }

      if (op === 'upload') {
        if (!data?.key && !data?.path && !data?.filename) {
          return { valid: false, error: 'Storage key or path is required for Upload' };
        }
        if (data?.content === undefined && data?.file === undefined && data?.data === undefined && data?.text === undefined && !data?.sourceStep) {
          return { valid: false, error: 'Content or file reference is required for Upload' };
        }
      }

      if (['download', 'delete', 'get_metadata'].includes(op)) {
        if (!data?.key && !data?.path && !data?.filename) {
          return { valid: false, error: `Storage key is required for ${op.replace('_', ' ')}` };
        }
      }
    }

    if (type === NodeTypes.ACTION_LOOP) {
      const validOps = ['loop_items', 'loop_batch', 'loop_range'];
      const op = String(data?.operation || 'loop_items').toLowerCase().trim();
      if (!validOps.includes(op)) {
        return { valid: false, error: `Invalid operation "${data?.operation}". Supported: ${validOps.join(', ')}` };
      }

      if (op === 'loop_items' || op === 'loop_batch') {
        const hasInput = (data?.items !== undefined && String(data.items).trim() !== '') ||
          (data?.collection !== undefined && String(data.collection).trim() !== '') ||
          (data?.array !== undefined && String(data.array).trim() !== '') ||
          (data?.input !== undefined && String(data.input).trim() !== '');
        if (!hasInput) {
          return { valid: false, error: 'Input collection or array expression is required for Loop' };
        }
      }

      if (op === 'loop_range') {
        const count = data?.count ?? data?.times ?? data?.stop;
        if (count === undefined || count === null || String(count).trim() === '') {
          return { valid: false, error: 'Count or range limit is required for Loop Range' };
        }
      }

      if (data?.batchSize !== undefined && data?.batchSize !== null && String(data.batchSize).trim() !== '') {
        const bs = parseInt(data.batchSize, 10);
        if (isNaN(bs) || bs < 1) {
          return { valid: false, error: 'Batch size must be a positive integer greater than or equal to 1' };
        }
      }

      if (data?.maxIterations !== undefined && data?.maxIterations !== null && String(data.maxIterations).trim() !== '') {
        const mi = parseInt(data.maxIterations, 10);
        if (isNaN(mi) || mi < 1) {
          return { valid: false, error: 'Maximum iterations must be a positive integer' };
        }
      }
    }

    if (type === NodeTypes.LOGIC_CONDITION || type === NodeTypes.ACTION_CONDITION) {
      if (Array.isArray(data?.conditions) && data.conditions.length > 0) {
        const comb = String(data.combinator || 'and').toLowerCase();
        if (!['and', 'or'].includes(comb)) {
          return { valid: false, error: 'Condition combinator must be "and" or "or"' };
        }
      } else if (data?.operator) {
        const validOps = [
          'equals', 'not_equals', 'not-equals', 'greater_than', 'greater-than', 'less_than', 'less-than',
          'greater_or_equal', 'greater-or-equal', 'less_or_equal', 'less-or-equal', 'contains', 'not_contains',
          'starts_with', 'starts-with', 'ends_with', 'ends-with', 'is_empty', 'is_not_empty', 'exists',
          'does_not_exist', 'is_true', 'is_false', 'matches_regex', 'does_not_match_regex',
        ];
        if (!validOps.includes(data.operator)) {
          return { valid: false, error: `Unsupported condition operator "${data.operator}"` };
        }
      }
    }

    if (type === NodeTypes.ACTION_SWITCH || type === NodeTypes.LOGIC_SWITCH) {
      if (data?.cases !== undefined && !Array.isArray(data.cases)) {
        return { valid: false, error: 'Switch cases must be an array' };
      }
      if (Array.isArray(data?.cases)) {
        const ids = new Set();
        for (const [idx, c] of data.cases.entries()) {
          const id = c.id || `case_${idx + 1}`;
          if (id === 'default') {
            return { valid: false, error: 'Case ID cannot be "default" (reserved for fallback branch)' };
          }
          if (ids.has(id)) {
            return { valid: false, error: `Duplicate switch case ID "${id}"` };
          }
          ids.add(id);
        }
      }
    }

    if (type === NodeTypes.ACTION_APPROVAL) {
      if (!data?.title || String(data.title).trim() === '') {
        return { valid: false, error: 'Approval title is required' };
      }
      if (data?.timeoutMinutes !== undefined && data.timeoutMinutes !== null && data.timeoutMinutes !== '') {
        const tm = parseInt(data.timeoutMinutes, 10);
        if (isNaN(tm) || tm < 1) {
          return { valid: false, error: 'Timeout minutes must be a positive integer' };
        }
      }
      if (data?.timeoutAction && !['reject', 'approve'].includes(String(data.timeoutAction).toLowerCase())) {
        return { valid: false, error: 'Timeout action must be either "reject" or "approve"' };
      }
    }

    if (type === NodeTypes.ACTION_WAIT || type === NodeTypes.ACTION_DELAY) {
      const waitType = String(data?.waitType || data?.type || 'duration').toLowerCase().trim();
      if (!['duration', 'date', 'event'].includes(waitType)) {
        return { valid: false, error: 'Wait type must be one of: duration, date, event' };
      }
      if (waitType === 'duration') {
        const dur = data?.durationSeconds ?? data?.seconds ?? data?.duration;
        if (dur === undefined || dur === null || String(dur).trim() === '') {
          return { valid: false, error: 'Duration in seconds is required for Wait duration' };
        }
      } else if (waitType === 'date') {
        const dt = data?.waitUntil ?? data?.date ?? data?.datetime;
        if (!dt || String(dt).trim() === '') {
          return { valid: false, error: 'Target timestamp (waitUntil) is required for Wait date' };
        }
      } else if (waitType === 'event') {
        const ev = data?.eventName ?? data?.event;
        if (!ev || String(ev).trim() === '') {
          return { valid: false, error: 'Event name is required for Wait event' };
        }
      }
    }

    if (type === NodeTypes.TRIGGER_WEBHOOK) {
      const authType = String(data?.authType || 'none').toLowerCase().trim();
      if (!['none', 'bearer', 'apikey', 'api_key', 'hmac'].includes(authType)) {
        return { valid: false, error: 'Auth type must be one of: none, bearer, apiKey, hmac' };
      }
      if (authType === 'bearer' && (!data?.authToken || !String(data.authToken).trim())) {
        return { valid: false, error: 'Bearer token is required when Bearer Auth is selected' };
      }
      if ((authType === 'apikey' || authType === 'api_key') && (!data?.apiKeyValue || !String(data.apiKeyValue).trim())) {
        return { valid: false, error: 'API Key value is required when API Key Auth is selected' };
      }
      if (authType === 'hmac') {
        if (!data?.hmacSecret || !String(data.hmacSecret).trim()) {
          return { valid: false, error: 'HMAC secret is required when HMAC Signature is selected' };
        }
        const algo = String(data?.hmacAlgorithm || 'sha256').toLowerCase().trim();
        if (!['sha256', 'sha512', 'sha1', 'md5'].includes(algo)) {
          return { valid: false, error: `Invalid HMAC algorithm "${algo}". Supported: sha256, sha512, sha1` };
        }
      }
      if (data?.responseStatus !== undefined && data?.responseStatus !== null && data?.responseStatus !== '') {
        const status = parseInt(data.responseStatus, 10);
        if (isNaN(status) || status < 100 || status > 599) {
          return { valid: false, error: 'Response status code must be a valid HTTP status between 100 and 599' };
        }
      }
    }

    // AI / LLM Nodes
    const isAiNode = [
      NodeTypes.ACTION_AI_GENERATE,
      NodeTypes.ACTION_AI_CHAT,
      NodeTypes.ACTION_AI_STRUCTURED,
      NodeTypes.ACTION_AI_CLASSIFY,
      NodeTypes.ACTION_AI_EMBEDDINGS,
      NodeTypes.ACTION_AI_AGENT,
    ].includes(type);

    if (isAiNode) {
      const provider = String(data?.provider || 'openai').toLowerCase().trim();
      const validProviders = ['openai', 'openrouter', 'anthropic', 'ollama'];
      if (!validProviders.includes(provider)) {
        return { valid: false, error: `Invalid AI provider "${provider}". Supported: ${validProviders.join(', ')}` };
      }

      if (type === NodeTypes.ACTION_AI_EMBEDDINGS && provider === 'anthropic') {
        return { valid: false, error: 'Anthropic does not support embeddings. Please select OpenAI, OpenRouter, or Ollama.' };
      }

      if (type === NodeTypes.ACTION_AI_GENERATE) {
        if (!data?.prompt || !String(data.prompt).trim()) {
          return { valid: false, error: 'Prompt is required for AI Generate' };
        }
      }

      if (type === NodeTypes.ACTION_AI_CHAT) {
        const hasMessages = Array.isArray(data?.messages) && data.messages.length > 0 && data.messages.some(m => String(m.content || '').trim().length > 0);
        const hasPrompt = Boolean(data?.prompt && String(data.prompt).trim());
        if (!hasMessages && !hasPrompt) {
          return { valid: false, error: 'At least one message or prompt is required for AI Chat' };
        }
      }

      if (type === NodeTypes.ACTION_AI_STRUCTURED) {
        if (!data?.prompt || !String(data.prompt).trim()) {
          return { valid: false, error: 'Prompt is required for AI Structured Output' };
        }
        if (!data?.schema || !String(data.schema).trim()) {
          return { valid: false, error: 'JSON Schema is required for AI Structured Output' };
        }
        if (typeof data.schema === 'string') {
          try {
            JSON.parse(data.schema);
          } catch {
            return { valid: false, error: 'Invalid JSON Schema syntax' };
          }
        }
      }

      if (type === NodeTypes.ACTION_AI_CLASSIFY) {
        if (!data?.input && !data?.text) {
          return { valid: false, error: 'Input text is required for AI Classification' };
        }
        let cats = data?.categories;
        if (typeof cats === 'string') {
          cats = cats.split(',').map(c => c.trim()).filter(Boolean);
        }
        if (!Array.isArray(cats) || cats.length < 2) {
          return { valid: false, error: 'At least two categories are required for AI Classification' };
        }
      }

      if (type === NodeTypes.ACTION_AI_EMBEDDINGS) {
        if (!data?.input && !data?.text) {
          return { valid: false, error: 'Input text is required for AI Embeddings' };
        }
      }

      if (type === NodeTypes.ACTION_AI_AGENT) {
        if (!data?.prompt && !data?.systemPrompt) {
          return { valid: false, error: 'User prompt or system instructions are required for AI Agent' };
        }
        if (data?.maxIterations !== undefined && data.maxIterations !== null && data.maxIterations !== '') {
          const it = parseInt(data.maxIterations, 10);
          if (isNaN(it) || it < 1) {
            return { valid: false, error: 'Max iterations must be a positive integer' };
          }
        }
        if (data?.maxToolCalls !== undefined && data.maxToolCalls !== null && data.maxToolCalls !== '') {
          const tc = parseInt(data.maxToolCalls, 10);
          if (isNaN(tc) || tc < 1) {
            return { valid: false, error: 'Max tool calls must be a positive integer' };
          }
        }
        if (data?.responseSchema && typeof data.responseSchema === 'string' && data.responseSchema.trim()) {
          try {
            JSON.parse(data.responseSchema);
          } catch {
            return { valid: false, error: 'Invalid response schema JSON syntax' };
          }
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validates if a new condition edge connection is allowed
   * @param {object} params - Connection parameters { source, target, sourceHandle }
   * @param {Array} edges - Existing edge list
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateConditionConnection(params, edges) {
    if (params.sourceHandle) {
      const isUniqueHandle = ['true', 'false', 'loop', 'done', 'default'].includes(params.sourceHandle) ||
        params.sourceHandle.startsWith('case_');
      if (isUniqueHandle) {
        const duplicate = edges.find(
          (e) => e.source === params.source && e.sourceHandle === params.sourceHandle
        );
        if (duplicate) {
          return {
            valid: false,
            error: `Node already has a ${params.sourceHandle.toUpperCase()} branch connection`,
          };
        }
      }
    }
    return { valid: true };
  }
}

export default NodeValidator;
