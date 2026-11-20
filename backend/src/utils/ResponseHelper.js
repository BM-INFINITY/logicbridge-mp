/**
 * Standardized HTTP Response Helper for Express Controllers
 */

function sanitizeMsg(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred';
  let clean = msg;
  // Mask MongoDB & database connection strings first before path matching
  clean = clean.replace(/(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"']+/gi, '[REDACTED_URI]');
  // Mask API keys and bearer tokens
  clean = clean.replace(/(?:sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_SECRET]');
  // Mask Windows & POSIX filesystem paths
  clean = clean.replace(/[A-Za-z]:\\[^"'\n\r\t<>\s]+/g, '[REDACTED_PATH]');
  clean = clean.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[REDACTED_PATH]');
  return clean;
}

class ResponseHelper {
  /**
   * Sends a successful JSON response
   * @param {object} res - Express response object
   * @param {any} data - Response payload
   * @param {number} [status=200] - HTTP status code
   */
  static success(res, data, status = 200) {
    return res.status(status).json(data);
  }

  /**
   * Sends a standardized error JSON response adhering to UX and API standards
   * @param {object} res - Express response object
   * @param {string} message - Error message string
   * @param {number} [status=500] - HTTP status code
   * @param {string} [code] - Specific error code (e.g. 'VALIDATION_ERROR')
   * @param {Array<object>} [details] - Detailed field errors or sub-items
   */
  static error(res, message, status = 500, code = null, details = []) {
    const isProd = process.env.NODE_ENV === 'production';
    let safeMessage = message || 'Internal Server Error';

    if (status >= 500 && isProd) {
      safeMessage = 'An internal server error occurred';
    } else {
      safeMessage = sanitizeMsg(safeMessage);
    }

    const resolvedCode =
      code ||
      (status === 400
        ? 'VALIDATION_ERROR'
        : status === 401
        ? 'AUTHENTICATION_REQUIRED'
        : status === 403
        ? 'PERMISSION_DENIED'
        : status === 404
        ? 'RESOURCE_NOT_FOUND'
        : status === 409
        ? 'RESOURCE_CONFLICT'
        : status === 422
        ? 'UNPROCESSABLE_ENTITY'
        : status === 429
        ? 'RATE_LIMIT_EXCEEDED'
        : status >= 500
        ? 'INTERNAL_SERVER_ERROR'
        : 'REQUEST_FAILED');

    const req = res.req;
    const requestId = (req && req.id) || (req && req.headers && req.headers['x-request-id']) || undefined;

    const formattedDetails = Array.isArray(details)
      ? details
      : details
      ? [details]
      : [];

    return res.status(status).json({
      success: false,
      message: safeMessage,
      error: {
        code: resolvedCode,
        message: safeMessage,
        details: formattedDetails,
        ...(requestId ? { requestId } : {}),
      },
    });
  }
}

module.exports = {
  ResponseHelper,
  success: ResponseHelper.success,
  error: ResponseHelper.error,
};
