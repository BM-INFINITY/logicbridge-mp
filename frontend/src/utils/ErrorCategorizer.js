/**
 * ErrorCategorizer — categorizes runtime errors into standard diagnostic categories
 * and provides contextual troubleshooting advice.
 *
 * Designed to work both in client React components and in pure Node.js environments.
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
      badgeVariant: 'danger',
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
      badgeVariant: 'warning',
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
      badgeVariant: 'warning',
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
      badgeVariant: 'danger',
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
    badgeVariant: 'danger',
    advice: 'The step execution encountered an unexpected error. Inspect the input payload and output logs below.',
  };
}
