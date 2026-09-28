const BaseNode = require('./BaseNode');
const { NodeTypes, HttpMethods } = require('../constants');
const { resolveVariable, redactSecrets } = require('../utils');
const ConnectionService = require('../services/ConnectionService');
const NodeExecutionError = require('../errors/NodeExecutionError');
const axios = require('axios');

class HttpNode extends BaseNode {
  constructor() {
    super({
      type: NodeTypes.ACTION_HTTP,
      name: 'HTTP Request',
      category: 'action',
      icon: '🌐',
      description: 'Executes HTTP requests with dynamic authentication, retries, timeouts, and form/JSON bodies',
      version: '2.0.0',
    });
  }

  validate(node) {
    if (!node?.data?.url || !String(node.data.url).trim()) {
      return { valid: false, error: 'HTTP node requires a valid URL' };
    }

    const method = String(node.data.method || 'GET').toUpperCase();
    const validMethods = Object.values(HttpMethods);
    if (!validMethods.includes(method)) {
      return { valid: false, error: `Invalid HTTP method "${method}". Supported methods: ${validMethods.join(', ')}` };
    }

    const { authType = 'none', authToken, apiKey, apiValue, authUsername, authPassword, connectionId } = node.data || {};
    if (authType === 'bearer' && !authToken?.trim()) {
      return { valid: false, error: 'Bearer Token is required when Bearer Auth is selected' };
    }
    if (authType === 'api_key' && (!apiKey?.trim() || !apiValue?.trim())) {
      return { valid: false, error: 'API Key name and value are required when API Key Auth is selected' };
    }
    if (authType === 'basic' && (!authUsername?.trim() || !authPassword?.trim())) {
      return { valid: false, error: 'Username and password are required when Basic Auth is selected' };
    }
    if (authType === 'connection' && !connectionId) {
      return { valid: false, error: 'Saved Connection must be selected when Connection Auth is chosen' };
    }

    const { contentType = 'json', body } = node.data || {};
    if (contentType === 'json' && body && typeof body === 'string' && !body.includes('{{')) {
      try {
        JSON.parse(body);
      } catch (err) {
        return { valid: false, error: `Invalid JSON body syntax: ${err.message}` };
      }
    }

    const timeout = Number(node.data.timeout ?? 15000);
    if (isNaN(timeout) || timeout < 100 || timeout > 300000) {
      return { valid: false, error: 'Timeout must be a number between 100ms and 300,000ms' };
    }

    const retries = Number(node.data.retries ?? 0);
    if (isNaN(retries) || retries < 0 || retries > 5) {
      return { valid: false, error: 'Retries must be an integer between 0 and 5' };
    }

    return { valid: true };
  }

  async execute(node, context) {
    const validation = this.validate(node);
    if (!validation.valid) throw new NodeExecutionError(validation.error, { nodeId: node.id, nodeType: this.type });

    const startedAt = Date.now();
    let {
      url = '',
      method = HttpMethods.GET,
      queryParamsList = [],
      headersList = [],
      body = '',
      authType = 'none',
      authToken = '',
      apiKey = '',
      apiValue = '',
      apiLocation = 'header',
      authUsername = '',
      authPassword = '',
      connectionId = '',
      contentType = 'json',
      formDataList = [],
      timeout = 15000,
      retries = 0,
      retryDelay = 1000,
      backoffStrategy = 'fixed',
      responseType = 'auto',
    } = node.data || {};

    const resolvedMethod = String(method).toUpperCase();

    // 1. Resolve URL & Query Parameters
    let resolvedUrl = resolveVariable(url, context);

    const queryParamsMap = [];
    if (Array.isArray(queryParamsList)) {
      queryParamsList.forEach((qp) => {
        if (qp.key && String(qp.key).trim()) {
          const resolvedKey = resolveVariable(qp.key, context).trim();
          const resolvedVal = resolveVariable(qp.value || '', context);
          queryParamsMap.push({ key: resolvedKey, value: resolvedVal });
        }
      });
    }

    // 2. Resolve Headers & Content-Type
    const customHeaders = { 'User-Agent': 'LogicBridge/2.0' };
    if (Array.isArray(headersList)) {
      headersList.forEach((h) => {
        if (h.key && String(h.key).trim()) {
          const resolvedKey = resolveVariable(h.key, context).trim();
          const resolvedVal = resolveVariable(h.value || '', context);
          customHeaders[resolvedKey] = resolvedVal;
        }
      });
    }

    // 3. Process Authentication
    if (authType === 'bearer') {
      const token = resolveVariable(authToken, context);
      customHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'api_key') {
      const resolvedKey = resolveVariable(apiKey, context);
      const resolvedVal = resolveVariable(apiValue, context);
      if (apiLocation === 'query') {
        queryParamsMap.push({ key: resolvedKey, value: resolvedVal });
      } else {
        customHeaders[resolvedKey] = resolvedVal;
      }
    } else if (authType === 'basic') {
      const user = resolveVariable(authUsername, context);
      const pass = resolveVariable(authPassword, context);
      const credentialsBase64 = Buffer.from(`${user}:${pass}`).toString('base64');
      customHeaders['Authorization'] = `Basic ${credentialsBase64}`;
    } else if (authType === 'connection' && connectionId) {
      const ownerId = context.ownerId || context.userId;
      if (!ownerId) {
        throw new NodeExecutionError('Missing ownerId in execution context to decrypt connection', { nodeId: node.id });
      }
      const conn = await ConnectionService.getConnectionById(connectionId, ownerId).catch(() => null);
      if (!conn || conn.status !== 'active') {
        throw new NodeExecutionError(`Connection "${connectionId}" is not active or found`, { nodeId: node.id });
      }
      const creds = await ConnectionService.getDecryptedCredentials(connectionId, ownerId);
      if (creds.token || creds.authToken || creds.authType === 'bearer') {
        customHeaders['Authorization'] = `Bearer ${creds.token || creds.authToken}`;
      } else if (creds.apiKey || creds.authType === 'api_key') {
        const loc = creds.apiLocation || 'header';
        if (loc === 'query') {
          queryParamsMap.push({ key: creds.apiKey, value: creds.apiValue });
        } else {
          customHeaders[creds.apiKey] = creds.apiValue;
        }
      } else if ((creds.username || creds.user) && (creds.password || creds.pass)) {
        const authStr = `${creds.username || creds.user}:${creds.password || creds.pass}`;
        customHeaders['Authorization'] = `Basic ${Buffer.from(authStr).toString('base64')}`;
      }
    }

    // Append query params to resolvedUrl
    if (queryParamsMap.length > 0) {
      try {
        const urlObj = new URL(resolvedUrl);
        queryParamsMap.forEach((qp) => {
          urlObj.searchParams.set(qp.key, qp.value);
        });
        resolvedUrl = urlObj.toString();
      } catch (err) {
        console.warn('[HttpNode] URL parsing skipped for queryParams:', err.message);
      }
    }

    // 4. Process Request Body & Content-Type
    let requestData = undefined;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(resolvedMethod)) {
      if (contentType === 'form-data') {
        customHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        const params = new URLSearchParams();
        if (Array.isArray(formDataList)) {
          formDataList.forEach((fd) => {
            if (fd.key && String(fd.key).trim()) {
              params.append(resolveVariable(fd.key, context).trim(), resolveVariable(fd.value || '', context));
            }
          });
        }
        requestData = params.toString();
      } else if (contentType === 'multipart') {
        // Use form-data package so Axios auto-generates the boundary in Content-Type header
        const FormData = require('form-data');
        const fd = new FormData();
        if (Array.isArray(formDataList)) {
          formDataList.forEach((fdItem) => {
            if (fdItem.key && String(fdItem.key).trim()) {
              fd.append(
                resolveVariable(fdItem.key, context).trim(),
                resolveVariable(fdItem.value || '', context)
              );
            }
          });
        }
        // Let form-data generate Content-Type with correct boundary
        Object.assign(customHeaders, fd.getHeaders());
        requestData = fd;
      } else if (contentType === 'text') {
        customHeaders['Content-Type'] = 'text/plain';
        requestData = resolveVariable(body, context);
      } else {
        // Default to JSON
        if (!customHeaders['Content-Type']) {
          customHeaders['Content-Type'] = 'application/json';
        }
        const resolvedBodyStr = resolveVariable(body, context);
        if (resolvedBodyStr && typeof resolvedBodyStr === 'string' && resolvedBodyStr.trim()) {
          try {
            requestData = JSON.parse(resolvedBodyStr);
          } catch {
            requestData = resolvedBodyStr;
          }
        } else {
          requestData = resolvedBodyStr || undefined;
        }
      }
    }

    // 5. Execute Request with Retry & Timeout Policy
    const timeoutMs = Math.min(Math.max(Number(timeout || 15000), 100), 300000);
    const maxRetries = Math.min(Math.max(Number(retries || 0), 0), 5);
    const delayMs = Math.max(Number(retryDelay || 1000), 0);
    const maxAttempts = 1 + maxRetries;

    let attempts = 0;
    let response = null;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const validAxiosResponseType = responseType === 'text' ? 'text' : 'json';

        response = await axios({
          method: resolvedMethod,
          url: resolvedUrl,
          data: requestData,
          timeout: timeoutMs,
          maxRedirects: 10,
          headers: customHeaders,
          responseType: validAxiosResponseType,
          validateStatus: (status) => status < 500,
        });

        // Break retry loop on successful completion (2xx, 3xx, 4xx)
        break;
      } catch (err) {
        lastError = err;
        const isRetryable =
          attempts < maxAttempts &&
          (!err.response || err.response.status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND');

        if (isRetryable) {
          const waitTime = backoffStrategy === 'exponential' ? delayMs * Math.pow(2, attempts - 1) : delayMs;
          await new Promise((r) => setTimeout(r, waitTime));
        } else {
          break;
        }
      }
    }

    if (!response && lastError) {
      const errorMsg = lastError.response
        ? `HTTP ${lastError.response.status} ${lastError.response.statusText || 'Server Error'}`
        : lastError.message;
      throw new NodeExecutionError(`HTTP Request failed after ${attempts} attempt(s): ${errorMsg}`, {
        nodeId: node.id,
        nodeType: this.type,
        originalError: lastError,
      });
    }

    // 6. Explicit Response Parsing Check
    let responseData = response.data;
    if (responseType === 'json' && typeof responseData === 'string') {
      try {
        responseData = JSON.parse(responseData);
      } catch (err) {
        throw new NodeExecutionError(`Failed to parse JSON response: ${err.message}`, { nodeId: node.id });
      }
    }

    const duration = Date.now() - startedAt;

    // 7. Return Standardized Output with Secret Redaction
    const combinedHeaders = { ...(response.headers || {}), ...customHeaders };

    const rawResult = {
      status: response.status,
      statusText: response.statusText || 'OK',
      url: resolvedUrl,
      method: resolvedMethod,
      headers: combinedHeaders,
      data: responseData,
      duration,
      attempts,
    };

    // Return result object where headers and sensitive metadata are safely redacted for execution logs
    return {
      ...rawResult,
      headers: redactSecrets(rawResult.headers),
    };
  }
}

module.exports = HttpNode;
