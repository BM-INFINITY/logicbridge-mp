/**
 * Validator for Workflow Variables and Secrets.
 * Enforces valid identifier names, prevents prototype pollution, and validates types/values.
 */

const BLOCKED_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
  'propertyisenumerable',
]);

const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;
const VALID_VARIABLE_TYPES = ['string', 'number', 'boolean', 'json'];

/**
 * Validates identifier name
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
function validateIdentifierName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'Name is required and must be a non-empty string' };
  }

  const trimmed = name.trim();

  if (BLOCKED_NAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: `Invalid name "${trimmed}": reserved keyword or object property` };
  }

  if (!VALID_IDENTIFIER_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: `Invalid name "${trimmed}". Names must start with a letter or underscore, contain only letters, numbers, hyphens, or underscores, and be 1-64 characters long`,
    };
  }

  return { valid: true, name: trimmed };
}

/**
 * Validates a workflow variable payload
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string, sanitized?: object }}
 */
function validateVariable(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Variable payload must be an object' };
  }

  const nameCheck = validateIdentifierName(payload.name);
  if (!nameCheck.valid) {
    return nameCheck;
  }

  const type = payload.type ? String(payload.type).toLowerCase() : 'string';
  if (!VALID_VARIABLE_TYPES.includes(type)) {
    return {
      valid: false,
      error: `Invalid variable type "${payload.type}". Supported types: ${VALID_VARIABLE_TYPES.join(', ')}`,
    };
  }

  let sanitizedValue = payload.value;

  if (type === 'number') {
    const num = Number(payload.value);
    if (isNaN(num)) {
      return { valid: false, error: `Value "${payload.value}" is not a valid number` };
    }
    sanitizedValue = num;
  } else if (type === 'boolean') {
    if (typeof payload.value === 'boolean') {
      sanitizedValue = payload.value;
    } else if (typeof payload.value === 'string') {
      const lower = payload.value.toLowerCase().trim();
      if (lower === 'true' || lower === '1') sanitizedValue = true;
      else if (lower === 'false' || lower === '0') sanitizedValue = false;
      else return { valid: false, error: `Value "${payload.value}" cannot be parsed as a boolean` };
    } else {
      sanitizedValue = Boolean(payload.value);
    }
  } else if (type === 'json') {
    if (typeof payload.value === 'string') {
      try {
        sanitizedValue = JSON.parse(payload.value);
      } catch (err) {
        return { valid: false, error: `Invalid JSON value: ${err.message}` };
      }
    } else if (typeof payload.value === 'object' && payload.value !== null) {
      sanitizedValue = payload.value;
    } else {
      return { valid: false, error: 'JSON variable value must be a valid JSON string or object' };
    }
  } else {
    // string
    sanitizedValue = payload.value !== undefined && payload.value !== null ? String(payload.value) : '';
  }

  return {
    valid: true,
    sanitized: {
      name: nameCheck.name,
      type,
      value: sanitizedValue,
      description: typeof payload.description === 'string' ? payload.description.trim().slice(0, 500) : '',
    },
  };
}

/**
 * Validates a workflow secret payload
 * @param {object} payload
 * @param {boolean} isUpdate - Whether this is an update (value can be optional to preserve existing)
 * @returns {{ valid: boolean, error?: string, sanitized?: object }}
 */
function validateSecret(payload, isUpdate = false) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Secret payload must be an object' };
  }

  const nameCheck = validateIdentifierName(payload.name);
  if (!nameCheck.valid) {
    return nameCheck;
  }

  if (!isUpdate && (payload.value === undefined || payload.value === null || String(payload.value).trim() === '')) {
    return { valid: false, error: 'Secret value is required' };
  }

  if (payload.value !== undefined && payload.value !== null) {
    if (typeof payload.value !== 'string') {
      return { valid: false, error: 'Secret value must be a string' };
    }
    if (payload.value.length > 8192) {
      return { valid: false, error: 'Secret value exceeds maximum length of 8192 characters' };
    }
  }

  return {
    valid: true,
    sanitized: {
      name: nameCheck.name,
      value: payload.value !== undefined ? String(payload.value) : undefined,
      description: typeof payload.description === 'string' ? payload.description.trim().slice(0, 500) : '',
    },
  };
}

module.exports = {
  validateIdentifierName,
  validateVariable,
  validateSecret,
  VALID_VARIABLE_TYPES,
};

