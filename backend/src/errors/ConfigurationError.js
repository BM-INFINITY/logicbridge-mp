class ConfigurationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConfigurationError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ConfigurationError;
