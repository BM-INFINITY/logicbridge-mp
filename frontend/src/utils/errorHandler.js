/**
 * frontend/src/utils/errorHandler.js
 * Centralized error parsing, user-friendly message normalization,
 * and toast notification deduplication for LogicBridge.
 */

import toast from 'react-hot-toast';

// Cache for recent toast messages to prevent duplicate spam
const recentToasts = new Map();
const TOAST_DEDUPE_WINDOW_MS = 2500;

/**
 * Standard Actionable Message Mappings (Phase 5)
 */
const CODE_MESSAGE_MAP = {
  NETWORK_ERROR: 'Unable to connect to LogicBridge. Check your connection and try again.',
  TIMEOUT_ERROR: 'The request timed out. Please check your connection and try again.',
  AUTHENTICATION_REQUIRED: 'Your session has expired. Please sign in again.',
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  RESOURCE_NOT_FOUND: 'The requested resource could not be found.',
  RESOURCE_CONFLICT: 'A resource with this identifier or name already exists.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again shortly.',
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  NODE_EXECUTION_ERROR: 'A workflow step failed during execution.',
  INVALID_JSON_BODY: 'Invalid request format received.',
};

/**
 * Parses any error into a normalized, structured object.
 *
 * @param {any} err - Caught error (AxiosError, Error, string, etc.)
 * @param {string} [fallbackMessage='An unexpected error occurred']
 * @returns {{
 *   message: string,
 *   code: string,
 *   details: Array<{ field?: string, message: string }>,
 *   fieldErrors: Record<string, string>,
 *   requestId?: string,
 *   status?: number,
 *   isNetworkError: boolean,
 *   isTimeout: boolean,
 *   isAuthError: boolean
 * }}
 */
export function parseApiError(err, fallbackMessage = 'An unexpected error occurred') {
  if (!err) {
    return {
      message: fallbackMessage,
      code: 'UNKNOWN_ERROR',
      details: [],
      fieldErrors: {},
      isNetworkError: false,
      isTimeout: false,
      isAuthError: false,
    };
  }

  // 1. Detect Client/Request Timeouts first
  const isTimeout =
    err.code === 'ECONNABORTED' ||
    (err.message && err.message.toLowerCase().includes('timeout')) ||
    err.response?.status === 504;

  if (isTimeout) {
    return {
      message: CODE_MESSAGE_MAP.TIMEOUT_ERROR,
      code: 'TIMEOUT_ERROR',
      details: [],
      fieldErrors: {},
      isNetworkError: false,
      isTimeout: true,
      isAuthError: false,
    };
  }

  // 2. Detect Network Disconnections / CORS blocks
  const isNetwork =
    err.code === 'ERR_NETWORK' ||
    err.message === 'Network Error' ||
    (err.isAxiosError && !err.response);

  if (isNetwork) {
    return {
      message: CODE_MESSAGE_MAP.NETWORK_ERROR,
      code: 'NETWORK_ERROR',
      details: [],
      fieldErrors: {},
      isNetworkError: true,
      isTimeout: false,
      isAuthError: false,
    };
  }

  // 3. Extract Server Error Envelope (Phase 2 format)
  const resData = err.response?.data;
  const status = err.response?.status;
  const requestId =
    resData?.error?.requestId ||
    err.response?.headers?.['x-request-id'] ||
    undefined;

  let code = resData?.error?.code;
  let rawMessage =
    resData?.error?.message ||
    resData?.message ||
    (typeof err === 'string' ? err : err.message);

  const rawDetails = resData?.error?.details || [];
  const details = Array.isArray(rawDetails) ? rawDetails : [];

  // Build fieldErrors map from details (for inline form feedback)
  const fieldErrors = {};
  details.forEach((d) => {
    if (d && d.field) {
      fieldErrors[d.field] = d.message;
    }
  });

  // Assign standard code based on HTTP status if code was missing
  if (!code && status) {
    if (status === 400) code = 'VALIDATION_ERROR';
    else if (status === 401) code = 'AUTHENTICATION_REQUIRED';
    else if (status === 403) code = 'PERMISSION_DENIED';
    else if (status === 404) code = 'RESOURCE_NOT_FOUND';
    else if (status === 409) code = 'RESOURCE_CONFLICT';
    else if (status === 429) code = 'RATE_LIMIT_EXCEEDED';
    else if (status >= 500) code = 'INTERNAL_SERVER_ERROR';
  }

  // Resolve user-friendly message
  let displayMessage = rawMessage || CODE_MESSAGE_MAP[code] || fallbackMessage;

  // Enhance generic 500 messages with Request ID for troubleshooting
  if (status >= 500 && requestId && !displayMessage.includes(requestId)) {
    displayMessage = `${CODE_MESSAGE_MAP.INTERNAL_SERVER_ERROR} (Ref: ${requestId})`;
  }

  return {
    message: displayMessage,
    code: code || 'REQUEST_FAILED',
    details,
    fieldErrors,
    requestId,
    status,
    isNetworkError: false,
    isTimeout: false,
    isAuthError: status === 401 || status === 403,
  };
}

/**
 * Extracts a map of field-level errors from an error response
 * @param {any} err
 * @returns {Record<string, string>} Map of field name -> error message
 */
export function getFieldErrors(err) {
  const parsed = parseApiError(err);
  return parsed.fieldErrors;
}

/**
 * Displays a toast error notification with automatic deduplication.
 * Prevents identical messages from bombarding the user within TOAST_DEDUPE_WINDOW_MS.
 *
 * @param {any} err - Caught error or string message
 * @param {string} [fallbackMessage] - Fallback message if err has no readable message
 * @param {object} [toastOptions] - Options passed to react-hot-toast
 * @returns {string|null} Toast ID or null if deduplicated
 */
export function showErrorToast(err, fallbackMessage, toastOptions = {}) {
  const parsed = typeof err === 'string'
    ? { message: err }
    : parseApiError(err, fallbackMessage);

  const message = parsed.message;
  const now = Date.now();
  const lastShown = recentToasts.get(message);

  if (lastShown && now - lastShown < TOAST_DEDUPE_WINDOW_MS) {
    return null; // Suppress duplicate
  }

  recentToasts.set(message, now);

  // Clean old entries periodically
  if (recentToasts.size > 50) {
    for (const [msg, time] of recentToasts.entries()) {
      if (now - time > TOAST_DEDUPE_WINDOW_MS) recentToasts.delete(msg);
    }
  }

  return toast.error(message, toastOptions);
}

export default {
  parseApiError,
  getFieldErrors,
  showErrorToast,
};
