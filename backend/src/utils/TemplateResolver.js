/**
 * Transforms input JSON template by resolving mustache variable references against previous node outputs
 * @param {string|object} template - JSON template string or template object
 * @param {object} prevData - Previous step output dataset
 * @returns {object} - Transformation result object
 */
function transformTemplate(template, prevData) {
  if (!template) {
    return { transformed: prevData || null, note: 'Pass-through of previous output' };
  }

  if (typeof template === 'string') {
    try {
      const parsedTpl = JSON.parse(template);
      const result = {};
      for (const [key, val] of Object.entries(parsedTpl)) {
        if (typeof val === 'string' && val.startsWith('{{') && val.endsWith('}}')) {
          const path = val.slice(2, -2).replace('prev.', '').trim();
          result[key] = path.split('.').reduce((o, k) => o?.[k], prevData) ?? val;
        } else {
          result[key] = val;
        }
      }
      return { transformed: result, source: 'previous_node' };
    } catch {
      return { transformed: template, source: 'raw' };
    }
  }

  return { transformed: template, source: 'object' };
}

module.exports = {
  transformTemplate,
  transform: transformTemplate,
};
