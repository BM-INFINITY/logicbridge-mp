const AuditLog = require('../models/AuditLog');
const { redactSecrets } = require('../utils/SecretRedactor');
const mongoose = require('mongoose');

const AuditEvents = Object.freeze({
  AUTH_LOGIN_SUCCESS: 'auth.login.success',
  AUTH_LOGIN_FAILURE: 'auth.login.failure',
  AUTH_ACCOUNT_LOCKED: 'auth.account.locked',
  AUTH_RATE_LIMIT_EXCEEDED: 'auth.rate_limit.exceeded',
  AUTH_REFRESH_TOKEN_ROTATED: 'auth.refresh_token.rotated',
  AUTH_REFRESH_TOKEN_REUSE_DETECTED: 'auth.refresh_token.reuse_detected',
  AUTH_SESSION_REVOKED: 'auth.session.revoked',
  AUTH_ROLE_CHANGED: 'auth.role.changed',
  OAUTH_CONNECTED: 'oauth.connected',
  OAUTH_DISCONNECTED: 'oauth.disconnected',
  CREDENTIAL_CREATED: 'credential.created',
  CREDENTIAL_UPDATED: 'credential.updated',
  CREDENTIAL_DELETED: 'credential.deleted',
  WEBHOOK_AUTH_FAILED: 'webhook.auth.failed',
  WEBHOOK_REPLAY_ATTEMPT: 'webhook.replay.attempt',
  AUTHORIZATION_FAILURE: 'authorization.failed',
  WORKFLOW_SECURITY_ACTION: 'workflow.security.action',
});

// Explicit list of forbidden keys that must be completely removed from details
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth/i,
  /state/i,
  /signature/i,
  /credential/i,
  /cookie/i,
];

// Fallback in-memory buffer for unit testing or when DB is disconnected
const inMemoryBuffer = [];
const MAX_BUFFER_SIZE = 100;

class AuditLoggerService {
  /**
   * Sanitizes the details object, removing any credentials, passwords, or tokens.
   * @param {object} details
   * @returns {object} Sanitized copy
   */
  _sanitizeDetails(details) {
    if (!details || typeof details !== 'object') {
      return {};
    }

    try {
      // First pass: deep clone and strip forbidden keys
      const stripped = JSON.parse(
        JSON.stringify(details, (key, value) => {
          if (key && SENSITIVE_KEY_PATTERNS.some((pat) => pat.test(key))) {
            return '[REDACTED]';
          }
          return value;
        })
      );

      // Second pass: apply SecretRedactor pattern-based masking on values
      return redactSecrets(stripped);
    } catch {
      return { note: '[Unserializable details sanitized]' };
    }
  }

  /**
   * Records a security audit event in a fail-safe manner.
   *
   * @param {object} params
   * @param {string} params.eventType - Defined in AuditEvents
   * @param {string} [params.severity='info'] - 'info' | 'warn' | 'error' | 'critical'
   * @param {string} [params.actorId=null] - User ID or 'system'
   * @param {string} [params.actorEmail=null] - User email
   * @param {string} [params.actorRole=null] - User role ('user', 'admin', 'approver', 'anonymous')
   * @param {string} [params.ipAddress=null] - Origin IP address
   * @param {string} [params.targetResource=null] - Resource descriptor (e.g. 'user:id', 'workflow:id')
   * @param {string} [params.correlationId=null] - Request / correlation ID
   * @param {string} [params.outcome='success'] - 'success' | 'failure' | 'blocked'
   * @param {object} [params.details={}] - Context metadata (strictly scrubbed)
   * @returns {Promise<object>} Created AuditLog record or memory buffer item
   */
  async recordEvent(params = {}) {
    const {
      eventType,
      severity = 'info',
      actorId = null,
      actorEmail = null,
      actorRole = null,
      ipAddress = null,
      targetResource = null,
      correlationId = null,
      outcome = 'success',
      details = {},
    } = params;

    if (!eventType) {
      console.warn('[AuditLogger] Missing eventType in recordEvent call');
      return null;
    }

    const sanitizedDetails = this._sanitizeDetails(details);

    const eventRecord = {
      timestamp: new Date(),
      eventType,
      severity,
      actorId: actorId ? String(actorId) : null,
      actorEmail: actorEmail ? String(actorEmail) : null,
      actorRole: actorRole ? String(actorRole) : null,
      ipAddress: ipAddress ? String(ipAddress) : null,
      targetResource: targetResource ? String(targetResource) : null,
      correlationId: correlationId ? String(correlationId) : null,
      outcome,
      details: sanitizedDetails,
    };

    // Keep recent events in memory buffer for immediate inspection / tests
    inMemoryBuffer.unshift({ ...eventRecord, _id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` });
    if (inMemoryBuffer.length > MAX_BUFFER_SIZE) {
      inMemoryBuffer.pop();
    }

    // Persist to MongoDB if connection is ready
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const doc = await AuditLog.create(eventRecord);
        return doc;
      } catch (err) {
        // Fail-safe: Audit logging failures must NEVER crash user operations
        console.warn(`[AuditLogger] Failed to persist audit log to MongoDB: ${err.message}`);
      }
    }

    return eventRecord;
  }

  /**
   * Queries audit logs with role-based access control and tenant isolation.
   *
   * @param {object} options
   * @param {object} options.user - Calling user object ({ _id, role })
   * @param {object} [options.filter] - Query filters (eventType, severity, actorId, dateFrom, dateTo)
   * @param {object} [options.pagination] - Pagination options { page, limit, skip }
   * @returns {Promise<{ logs: Array, total: number, page: number, limit: number }>}
   */
  async queryLogs(options = {}) {
    const { user, filter = {}, pagination = {} } = options;

    if (!user) {
      const err = new Error('Authentication required to query audit logs');
      err.statusCode = 401;
      throw err;
    }

    const isAdmin = user.role === 'admin';
    const query = {};

    // Tenant isolation: standard users can ONLY query their own actorId
    if (!isAdmin) {
      query.actorId = String(user._id);
    } else if (filter.actorId) {
      query.actorId = String(filter.actorId);
    }

    if (filter.eventType) {
      query.eventType = filter.eventType;
    }
    if (filter.severity) {
      query.severity = filter.severity;
    }
    if (filter.outcome) {
      query.outcome = filter.outcome;
    }
    if (filter.targetResource) {
      query.targetResource = { $regex: filter.targetResource, $options: 'i' };
    }
    if (filter.dateFrom || filter.dateTo) {
      query.timestamp = {};
      if (filter.dateFrom) query.timestamp.$gte = new Date(filter.dateFrom);
      if (filter.dateTo) query.timestamp.$lte = new Date(filter.dateTo);
    }

    const limit = Math.min(Math.max(parseInt(pagination.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(pagination.page, 10) || 1, 1);
    const skip = pagination.skip !== undefined ? parseInt(pagination.skip, 10) : (page - 1) * limit;

    // Use MongoDB if connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const [logs, total] = await Promise.all([
          AuditLog.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          AuditLog.countDocuments(query),
        ]);
        return { logs, total, page, limit };
      } catch (err) {
        console.warn(`[AuditLogger] MongoDB query failed, falling back to memory buffer: ${err.message}`);
      }
    }

    // Fallback: in-memory buffer filtering (for tests and offline mode)
    let filtered = inMemoryBuffer.filter((item) => {
      if (query.actorId && item.actorId !== query.actorId) return false;
      if (query.eventType && item.eventType !== query.eventType) return false;
      if (query.severity && item.severity !== query.severity) return false;
      if (query.outcome && item.outcome !== query.outcome) return false;
      return true;
    });

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);
    return { logs: paginated, total, page, limit };
  }

  /**
   * Explicitly purges audit logs older than the specified retention days.
   * Note: MongoDB TTL index purges automatically in the background.
   *
   * @param {number} [days=90]
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanOldLogs(days = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const res = await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
        return res.deletedCount || 0;
      } catch (err) {
        console.warn(`[AuditLogger] Failed to purge old logs: ${err.message}`);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Helper for tests: retrieves recent in-memory events
   */
  _getRecentEvents() {
    return [...inMemoryBuffer];
  }

  /**
   * Helper for tests: clears in-memory events
   */
  _clearEvents() {
    inMemoryBuffer.length = 0;
  }
}

const auditLoggerInstance = new AuditLoggerService();
auditLoggerInstance.AuditEvents = AuditEvents;

module.exports = auditLoggerInstance;
