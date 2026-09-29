const { MongoClient, ObjectId } = require('mongodb');
const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable } = require('../utils');
const { connectionRegistry } = require('../providers/connections');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * Parses and resolves variable expressions in an object or JSON string
 */
function resolveJsonOrObject(value, context) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map((item) => resolveJsonOrObject(item, context));
    }
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') {
        const res = resolveVariable(v, context);
        try {
          resolved[k] = JSON.parse(res);
        } catch {
          resolved[k] = res;
        }
      } else if (typeof v === 'object' && v !== null) {
        resolved[k] = resolveJsonOrObject(v, context);
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
      return resolvedStr;
    }
  }

  return value;
}

/**
 * Normalizes _id fields into ObjectId where appropriate
 */
function normalizeObjectIds(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(normalizeObjectIds);
  }

  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '_id' && typeof v === 'string' && ObjectId.isValid(v) && v.length === 24) {
      try {
        result[k] = new ObjectId(v);
        continue;
      } catch {
        // Fall back to original value
      }
    } else if (v && typeof v === 'object' && v.$oid && typeof v.$oid === 'string') {
      try {
        result[k] = new ObjectId(v.$oid);
        continue;
      } catch {
        // Fall back
      }
    } else if (v && typeof v === 'object') {
      result[k] = normalizeObjectIds(v);
      continue;
    }
    result[k] = v;
  }
  return result;
}

class MongoNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_MONGODB,
      name: 'MongoDB',
      category: 'action',
      icon: '🍃',
      description: 'Execute queries, inserts, updates, and deletes on a MongoDB collection',
      version: '1.0.0',
    });
  }

  validate(node) {
    const data = node?.data || {};
    const { connectionId, operation = 'find', collection, filter, document, update, data: docData } = data;

    if (!connectionId || !String(connectionId).trim()) {
      return { valid: false, error: 'MongoDB connection is required' };
    }

    const validOps = ['find', 'findOne', 'insertOne', 'insertMany', 'updateOne', 'deleteOne', 'count'];
    if (!validOps.includes(operation)) {
      return { valid: false, error: `Invalid operation "${operation}". Supported: ${validOps.join(', ')}` };
    }

    if (!collection || !String(collection).trim()) {
      return { valid: false, error: 'Collection name is required' };
    }

    if (operation === 'insertOne') {
      const doc = document || docData;
      if (!doc || (typeof doc === 'object' && Object.keys(doc).length === 0)) {
        return { valid: false, error: 'Document data is required for insertOne' };
      }
    }

    if (operation === 'insertMany') {
      const docs = document || docData;
      if (!docs || (Array.isArray(docs) && docs.length === 0)) {
        return { valid: false, error: 'Documents array is required for insertMany' };
      }
    }

    if (operation === 'updateOne') {
      const upd = update || document || docData;
      if (!upd || (typeof upd === 'object' && Object.keys(upd).length === 0)) {
        return { valid: false, error: 'Update data is required for updateOne' };
      }
      if (!filter || (typeof filter === 'object' && Object.keys(filter).length === 0)) {
        return { valid: false, error: 'Filter is required for updateOne' };
      }
    }

    if (operation === 'deleteOne') {
      if (!filter || (typeof filter === 'object' && Object.keys(filter).length === 0)) {
        return { valid: false, error: 'Filter is required for deleteOne to avoid accidental deletion' };
      }
    }

    return { valid: true };
  }

  createClient(credentials) {
    const provider = connectionRegistry.resolve('mongodb');
    const uri = provider.getUri(credentials);
    return new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  }

  async execute(node, context) {
    const data = node?.data || {};
    const {
      connectionId,
      operation = 'find',
      database,
      collection,
      filter,
      document,
      update,
      limit,
      sort,
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

    const targetDbName = database || credentials.database || 'admin';
    const client = context?._mongoClient || this._clientOverride || this.createClient(credentials);
    const shouldClose = !context?._mongoClient && !this._clientOverride;

    try {
      if (shouldClose) {
        await client.connect();
      }

      const db = client.db(targetDbName);
      const col = db.collection(collection);

      // Parse and normalize filter
      const rawFilter = resolveJsonOrObject(filter, context) || {};
      const normalizedFilter = normalizeObjectIds(rawFilter);

      let result;

      switch (operation) {
        case 'find': {
          let queryLimit = 100;
          if (limit !== undefined && limit !== null && String(limit).trim() !== '') {
            const parsedLimit = parseInt(resolveVariable(String(limit), context), 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) queryLimit = parsedLimit;
          }

          let cursor = col.find(normalizedFilter).limit(queryLimit);

          const rawSort = resolveJsonOrObject(sort, context);
          if (rawSort && typeof rawSort === 'object' && Object.keys(rawSort).length > 0) {
            cursor = cursor.sort(rawSort);
          }

          const documents = await cursor.toArray();
          result = {
            documents,
            count: documents.length,
            rows: documents,
            data: documents,
            operation: 'find',
          };
          break;
        }

        case 'findOne': {
          const doc = await col.findOne(normalizedFilter);
          result = {
            document: doc,
            found: !!doc,
            data: doc,
            operation: 'findOne',
          };
          break;
        }

        case 'insertOne': {
          const rawDoc = resolveJsonOrObject(document || data.data, context);
          if (!rawDoc || typeof rawDoc !== 'object') {
            throw new Error('Document must be a valid object for insertOne');
          }
          const normalizedDoc = normalizeObjectIds(rawDoc);
          const insertRes = await col.insertOne(normalizedDoc);
          result = {
            insertedId: insertRes.insertedId,
            acknowledged: insertRes.acknowledged,
            operation: 'insertOne',
            data: { insertedId: insertRes.insertedId },
          };
          break;
        }

        case 'insertMany': {
          let rawDocs = resolveJsonOrObject(document || data.data, context);
          if (typeof rawDocs === 'string') {
            try {
              rawDocs = JSON.parse(rawDocs);
            } catch {
              // ignore
            }
          }
          if (!Array.isArray(rawDocs)) {
            if (rawDocs && typeof rawDocs === 'object') {
              rawDocs = [rawDocs];
            } else {
              throw new Error('Documents must be an array for insertMany');
            }
          }
          const normalizedDocs = rawDocs.map(normalizeObjectIds);
          const insertManyRes = await col.insertMany(normalizedDocs);
          result = {
            insertedCount: insertManyRes.insertedCount,
            insertedIds: insertManyRes.insertedIds,
            acknowledged: insertManyRes.acknowledged,
            operation: 'insertMany',
            data: { insertedCount: insertManyRes.insertedCount },
          };
          break;
        }

        case 'updateOne': {
          let rawUpdate = resolveJsonOrObject(update || document || data.data, context);
          if (!rawUpdate || typeof rawUpdate !== 'object') {
            throw new Error('Update payload must be an object for updateOne');
          }
          // If update doesn't have atomic operators ($set, $inc, etc.), wrap with $set
          const hasAtomicOp = Object.keys(rawUpdate).some((k) => k.startsWith('$'));
          const updatePayload = hasAtomicOp ? rawUpdate : { $set: rawUpdate };
          const normalizedUpdate = normalizeObjectIds(updatePayload);

          const updateRes = await col.updateOne(normalizedFilter, normalizedUpdate);
          result = {
            matchedCount: updateRes.matchedCount,
            modifiedCount: updateRes.modifiedCount,
            upsertedId: updateRes.upsertedId,
            acknowledged: updateRes.acknowledged,
            operation: 'updateOne',
            data: { matchedCount: updateRes.matchedCount, modifiedCount: updateRes.modifiedCount },
          };
          break;
        }

        case 'deleteOne': {
          const deleteRes = await col.deleteOne(normalizedFilter);
          result = {
            deletedCount: deleteRes.deletedCount,
            acknowledged: deleteRes.acknowledged,
            operation: 'deleteOne',
            data: { deletedCount: deleteRes.deletedCount },
          };
          break;
        }

        case 'count': {
          const count = await col.countDocuments(normalizedFilter);
          result = {
            count,
            operation: 'count',
            data: { count },
          };
          break;
        }

        default:
          throw new Error(`Unsupported MongoDB operation: "${operation}"`);
      }

      return result;
    } catch (err) {
      const sanitized = (err.message || 'MongoDB error').replace(/:\/\/([^:\s]+):([^@\s]+)@/g, '://$1:[REDACTED]@');
      throw new NodeExecutionError(`MongoDB execution error: ${sanitized}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: err,
      });
    } finally {
      if (shouldClose) {
        await client.close().catch(() => {});
      }
    }
  }
}

module.exports = MongoNode;
