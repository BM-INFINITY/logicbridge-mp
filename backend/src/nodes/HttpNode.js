const BaseNode = require('./BaseNode');
const { NodeTypes, HttpMethods } = require('../constants');
const { resolveVariable } = require('../utils');
const axios = require('axios');

class HttpNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_HTTP,
      name: 'HTTP Request',
      category: 'action',
      icon: '🌐',
      description: 'Executes HTTP GET/POST/PUT/DELETE requests with parameter and header builders',
      version: '1.0.0',
    });
  }

  validate(node) {
    if (!node?.data?.url || !node.data.url.trim()) {
      return { valid: false, error: 'HTTP node requires a valid URL' };
    }
    return { valid: true };
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) throw new Error(validation.error);

    let { url, method = HttpMethods.GET, body = '', queryParamsList = [], headersList = [] } = node.data || {};
    const prev = context.lastOutput;
    let resolvedUrl = resolveVariable(url, prev);

    // Append query parameters
    if (Array.isArray(queryParamsList) && queryParamsList.length > 0) {
      try {
        const urlObj = new URL(resolvedUrl);
        queryParamsList.forEach(qp => {
          if (qp.key && qp.key.trim()) {
            urlObj.searchParams.set(qp.key.trim(), resolveVariable(qp.value || '', prev));
          }
        });
        resolvedUrl = urlObj.toString();
      } catch (err) {
        console.warn('[HttpNode] URL parsing skipped for queryParams:', err.message);
      }
    }

    // Build headers
    const customHeaders = { 'User-Agent': 'LogicBridge/1.0' };
    if (Array.isArray(headersList)) {
      headersList.forEach(h => {
        if (h.key && h.key.trim()) {
          customHeaders[h.key.trim()] = resolveVariable(h.value || '', prev);
        }
      });
    }

    const response = await axios({
      method,
      url: resolvedUrl,
      data: body ? resolveVariable(body, prev) : undefined,
      timeout: 15000,
      maxRedirects: 10,
      headers: customHeaders,
      validateStatus: status => status < 500,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      url: resolvedUrl,
      method,
      data: response.data,
      headers: response.headers,
    };
  }
}

module.exports = HttpNode;
