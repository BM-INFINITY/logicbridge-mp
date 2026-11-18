/**
 * Standardized HTTP Response Helper for Express Controllers
 */

function sanitizeMsg(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred';
  let clean = msg;
  clean = clean.replace(/[A-Za-z]:\\[^"'\n\r\t<>]+/g, '[REDACTED_PATH]');
  clean = clean.replace(/\/(?:[a-zA-Z0-9_.-]+\/)+[a-zA-Z0-9_.-]+/g, '[REDACTED_PATH]');
  clean = clean.replace(/(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s"']+/gi, '[REDACTED_URI]');
  clean = clean.replace(/(?:sk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_.-]+)/gi, '[REDACTED_SECRET]');
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
   * Sends a standardized error JSON response
   * @param {object} res - Express response object
   * @param {string} message - Error message string
   * @param {number} [status=500] - HTTP status code
   */
  static error(res, message, status = 500) {
    const isProd = process.env.NODE_ENV === 'production';
    let safeMessage = message || 'Internal Server Error';

    if (status >= 500 && isProd) {
      safeMessage = 'An internal server error occurred';
    } else {
      safeMessage = sanitizeMsg(safeMessage);
    }

    return res.status(status).json({ message: safeMessage });
  }
}

module.exports = {
  ResponseHelper,
  success: ResponseHelper.success,
  error: ResponseHelper.error,
};
