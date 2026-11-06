import React, { useState, useMemo } from 'react';
import {
  AlertTriangle, XCircle, Copy, Check, ChevronDown, ChevronRight,
  ExternalLink, RefreshCw, Settings, ShieldAlert, Clock, Database, Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Badge, Alert } from '../ui';

/**
 * Classifies an error message into standard diagnostic categories
 * @param {string} errorText
 * @param {string} nodeType
 * @returns {{ category: string, label: string, color: string, icon: any, advice: string }}
 */
export function categorizeError(errorText = '', nodeType = '') {
  const err = String(errorText).toLowerCase();

  // 1. Authorization / Authentication
  if (
    err.includes('401') ||
    err.includes('403') ||
    err.includes('unauthorized') ||
    err.includes('forbidden') ||
    err.includes('invalid api key') ||
    err.includes('token expired') ||
    err.includes('authentication')
  ) {
    return {
      category: 'AUTH_ERROR',
      label: 'Authorization Error',
      color: '#ef4444',
      icon: ShieldAlert,
      advice: 'Verify that your connection credentials, API keys, or OAuth tokens are valid and not expired in Settings > Connections.',
    };
  }

  // 2. Timeout / Gateway
  if (
    err.includes('timeout') ||
    err.includes('timed out') ||
    err.includes('504') ||
    err.includes('gateway') ||
    err.includes('econnaborted') ||
    err.includes('expired')
  ) {
    return {
      category: 'TIMEOUT_ERROR',
      label: 'Timeout Error',
      color: '#f59e0b',
      icon: Clock,
      advice: 'The destination server or approval step took too long to respond. Consider increasing the step timeout or checking target service latency.',
    };
  }

  // 3. Configuration / Validation
  if (
    err.includes('required') ||
    err.includes('invalid') ||
    err.includes('syntax') ||
    err.includes('cannot read property') ||
    err.includes('undefined') ||
    err.includes('json parse') ||
    err.includes('schema') ||
    err.includes('missing')
  ) {
    return {
      category: 'CONFIG_ERROR',
      label: 'Configuration Error',
      color: '#ec4899',
      icon: Settings,
      advice: 'Required configuration parameters are missing or malformed. Open the step settings to inspect field mappings and input expressions.',
    };
  }

  // 4. Provider / Network / Third-Party
  if (
    err.includes('econnrefused') ||
    err.includes('getaddrinfo') ||
    err.includes('enotfound') ||
    err.includes('500') ||
    err.includes('502') ||
    err.includes('503') ||
    err.includes('openai') ||
    err.includes('anthropic') ||
    err.includes('slack') ||
    err.includes('discord') ||
    err.includes('rate limit') ||
    err.includes('429')
  ) {
    return {
      category: 'PROVIDER_ERROR',
      label: 'Provider / Service Error',
      color: '#8b5cf6',
      icon: Globe,
      advice: nodeType.startsWith('action-ai')
        ? 'The AI model provider reported a service error or rate limit. Verify model availability and quota limits.'
        : 'The external API service is unreachable or returned a server failure. Check external system health.',
    };
  }

  // 5. General Execution Failure
  return {
    category: 'EXECUTION_FAILURE',
    label: 'Execution Failure',
    color: '#ef4444',
    icon: XCircle,
    advice: 'The step encountered an unexpected runtime failure during workflow processing. Review input payloads and downstream dependencies.',
  };
}

export default function ErrorDebugger({
  step,
  executionError,
  onNavigateToNode,
  onRetry,
}) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorString = step?.error || executionError || 'Unknown execution error';
  const nodeType = step?.nodeType || '';
  const nodeName = step?.nodeName || 'Workflow Step';
  const nodeId = step?.nodeId;

  const diagnostic = useMemo(() => {
    return categorizeError(errorString, nodeType);
  }, [errorString, nodeType]);

  const IconComponent = diagnostic.icon;

  const handleCopy = () => {
    const diagnosticSummary = `[LogicBridge Error Report]\nStep: ${nodeName} (${nodeType})\nCategory: ${diagnostic.label}\nMessage: ${errorString}\nTimestamp: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(diagnosticSummary);
    setCopied(true);
    toast.success('Error details copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header with Category Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `${diagnostic.color}18`,
              color: diagnostic.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconComponent size={16} />
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              {nodeName}
            </div>
            {nodeType && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Type: <code>{nodeType}</code>
              </div>
            )}
          </div>
        </div>

        <Badge
          variant="danger"
          size="sm"
          style={{ background: `${diagnostic.color}20`, color: diagnostic.color, border: `1px solid ${diagnostic.color}40` }}
        >
          {diagnostic.label}
        </Badge>
      </div>

      {/* Main Error Message */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          color: 'var(--accent-danger)',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          lineHeight: 1.45,
          wordBreak: 'break-word',
        }}
      >
        {errorString}
      </div>

      {/* Suggested Corrective Action */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderLeft: `3px solid ${diagnostic.color}`,
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>Suggested Action: </strong>
        {diagnostic.advice}
      </div>

      {/* Action Buttons: Copy, Configure, Retry */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          icon={copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
          style={{ fontSize: '0.72rem' }}
        >
          {copied ? 'Copied' : 'Copy Error'}
        </Button>

        {nodeId && onNavigateToNode && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigateToNode(nodeId)}
            icon={<Settings size={12} />}
            style={{ fontSize: '0.72rem' }}
          >
            Configure Step
          </Button>
        )}

        {onRetry && (
          <Button
            variant="primary"
            size="sm"
            onClick={onRetry}
            icon={<RefreshCw size={12} />}
            style={{ fontSize: '0.72rem', marginLeft: 'auto' }}
          >
            Retry Execution
          </Button>
        )}
      </div>

      {/* Expandable Technical Details */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 8 }}>
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {showTechnical ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <span>{showTechnical ? 'Hide Technical Context' : 'Show Technical Context'}</span>
        </button>

        {showTechnical && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              background: 'var(--bg-elevated)',
              borderRadius: 6,
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              lineHeight: 1.4,
              overflowX: 'auto',
            }}
          >
            <div>Node ID: {nodeId || 'N/A'}</div>
            <div>Timestamp: {step?.finishedAt || step?.startedAt || new Date().toISOString()}</div>
            {step?.duration !== undefined && <div>Execution Time before fail: {step.duration}ms</div>}
            {step?.input && (
              <div style={{ marginTop: 4 }}>
                <strong>Inputs Received:</strong> {JSON.stringify(step.input).slice(0, 180)}...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
