const BaseNode = require('./BaseNode');
const { NodeTypes } = require('../constants');
const { resolveVariable, logExecution } = require('../utils');
const { mailProvider } = require('../providers');
const { connectionRegistry } = require('../providers/connections');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');

/**
 * EmailNode — dispatches email via either:
 *   a) A user-owned connection (Gmail, SMTP) if node.data.connectionId is set
 *   b) The platform SMTP provider as a fallback (preserves backward compatibility)
 *
 * Routing:
 *   connectionId present → ConnectionRegistry → provider.sendEmail()
 *   no connectionId      → platform mailProvider.send()
 */
class EmailNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_EMAIL,
      name: 'Send Email',
      category: 'action',
      icon: '📧',
      description: 'Sends automated email notifications from your connected account',
      version: '3.0.0',
    });
  }

  validate(node) {
    const { to, subject } = node.data || {};
    if (!to || !String(to).trim()) {
      return { valid: false, error: 'Recipient email ("to") is required' };
    }
    if (!subject || !String(subject).trim()) {
      return { valid: false, error: 'Email subject is required' };
    }
    return { valid: true };
  }

  async execute(node, context) {
    const startedAt = Date.now();
    const {
      connectionId = '',
      to = '',
      subject = 'LogicBridge Notification',
      body = '',
      html = '',
      cc = '',
      bcc = '',
    } = node.data || {};

    const prev = context.lastOutput;

    // Resolve workflow variables in all fields
    const resolvedTo      = resolveVariable(to, prev);
    const resolvedSubject = resolveVariable(subject, prev);
    const resolvedBody    = typeof body === 'object'
      ? JSON.stringify(body)
      : resolveVariable(body, prev);
    const resolvedHtml    = resolveVariable(html, prev);
    const resolvedCc      = resolveVariable(cc, prev);
    const resolvedBcc     = resolveVariable(bcc, prev);

    if (!resolvedTo || !resolvedTo.trim()) {
      throw new NodeExecutionError(
        'Recipient email ("to") resolved to empty — check variable references',
        { nodeId: node.id, nodeName: node.data?.label, nodeType: this.type }
      );
    }

    const mailOptions = {
      to: resolvedTo,
      cc: resolvedCc || undefined,
      bcc: resolvedBcc || undefined,
      subject: resolvedSubject,
      text: resolvedBody || undefined,
      html: resolvedHtml || undefined,
    };

    let result;
    let providerLabel = 'smtp';

    if (connectionId) {
      // ── Path A: user-owned connection ────────────────────────────────────────
      const ownerId = context.ownerId || context.userId;
      if (!ownerId) {
        throw new NodeExecutionError(
          'Cannot resolve connection credentials: execution context is missing ownerId',
          { nodeId: node.id, nodeType: this.type }
        );
      }

      // Load connection document (no credentials exposed)
      const conn = await ConnectionService.getConnectionById(connectionId, ownerId).catch(() => null);
      if (!conn) {
        throw new NodeExecutionError(
          `Connection "${connectionId}" not found. Check your Email node configuration.`,
          { nodeId: node.id, nodeType: this.type }
        );
      }

      if (conn.status !== 'active') {
        throw new NodeExecutionError(
          `Connection "${conn.name}" is ${conn.status}. Please reconnect it in the Connections page.`,
          { nodeId: node.id, nodeType: this.type }
        );
      }

      const credentials = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
      const provider = connectionRegistry.resolve(conn.provider);
      providerLabel = conn.provider;

      logExecution(
        `[EmailNode] Dispatching via connection | provider=${conn.provider} | to="${resolvedTo}" | subject="${resolvedSubject}"`
      );

      try {
        result = await provider.sendEmail(credentials, mailOptions);
      } catch (err) {
        throw new NodeExecutionError(err.message, {
          nodeId: node.id, nodeName: node.data?.label, nodeType: this.type, originalError: err,
        });
      }
    } else {
      // ── Path B: platform SMTP fallback ───────────────────────────────────────
      logExecution(
        `[EmailNode] Dispatching via platform SMTP | to="${resolvedTo}" | subject="${resolvedSubject}"`
      );

      try {
        result = await mailProvider.send(mailOptions);
      } catch (err) {
        throw new NodeExecutionError(err.message, {
          nodeId: node.id, nodeName: node.data?.label, nodeType: this.type, originalError: err,
        });
      }
    }

    const durationMs = Date.now() - startedAt;

    logExecution(
      `[EmailNode] ✓ Delivered | messageId=${result.messageId} | accepted=${(result.accepted || []).join(',')} | provider=${providerLabel} | duration=${durationMs}ms`
    );

    return {
      ...result,
      to: resolvedTo,
      subject: resolvedSubject,
      provider: providerLabel,
      durationMs,
      status: 200,
      message: result.delivered
        ? `Email successfully delivered to ${resolvedTo} via ${providerLabel}`
        : `Email accepted but flagged — check rejected list`,
    };
  }
}

module.exports = EmailNode;
