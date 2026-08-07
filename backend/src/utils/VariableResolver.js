/**
 * Utility function for resolving mustache variable expressions in node fields
 * e.g. {{ step_1.fieldName }} or {{ prev.fieldName }}
 *
 * @param {string} str - Input template string containing {{ expression }}
 * @param {object} context - Previous step output or dataset object
 * @returns {string} - Interpolated string with resolved variable values
 */
function resolveVariable(str, context) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
    const cleanPath = path.replace(/^(step_\w+|prev)\./, '').trim();
    let val = cleanPath.split('.').reduce((o, k) => o?.[k], context);
    if (val === undefined && context?.data) {
      val = cleanPath.split('.').reduce((o, k) => o?.[k], context.data);
    }
    return val !== undefined ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : '';
  });
}

module.exports = {
  resolveVariable,
  resolve: resolveVariable,
};
