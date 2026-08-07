/**
 * Standardized HTTP Response Helper for Express Controllers
 */
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
    return res.status(status).json({ message: message || 'Internal Server Error' });
  }
}

module.exports = {
  ResponseHelper,
  success: ResponseHelper.success,
  error: ResponseHelper.error,
};
