const axios = require('axios');
const { LLMProvider } = require('./LLMProvider');
const { NodeExecutionError } = require('../../errors');

class OllamaProvider extends LLMProvider {
  constructor(options = {}) {
    super({
      id: options.id || 'ollama',
      name: options.name || 'Ollama',
      defaultBaseUrl: options.defaultBaseUrl || 'http://localhost:11434',
      capabilities: options.capabilities || ['generate', 'chat', 'structured', 'classify', 'embeddings'],
      defaultModels: options.defaultModels || {
        chat: 'llama3',
        generate: 'llama3',
        structured: 'llama3',
        classify: 'llama3',
        embeddings: 'nomic-embed-text',
      },
    });
  }

  _getHeaders(apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  async chat({
    messages = [],
    systemPrompt = '',
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    stop,
    apiKey,
    baseUrl,
    timeout = 30000,
    httpClient = axios,
    format,
    tools,
  } = {}) {
    this.validateCapability('chat');
    const endpoint = `${(baseUrl || this.defaultBaseUrl).replace(/\/+$/, '')}/api/chat`;

    const formattedMessages = [];
    if (systemPrompt && String(systemPrompt).trim()) {
      formattedMessages.push({ role: 'system', content: String(systemPrompt).trim() });
    }

    if (Array.isArray(messages)) {
      messages.forEach((m) => {
        if (typeof m === 'string') {
          formattedMessages.push({ role: 'user', content: m });
        } else if (m && typeof m === 'object') {
          if (m.role === 'tool') {
            formattedMessages.push({
              role: 'tool',
              content: typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content || ''),
            });
          } else if (m.tool_calls || m.toolCalls) {
            formattedMessages.push({
              role: 'assistant',
              content: m.content || '',
              tool_calls: m.tool_calls || m.toolCalls,
            });
          } else {
            formattedMessages.push({
              role: m.role || 'user',
              content: typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content || ''),
            });
          }
        }
      });
    }

    const payload = {
      model: model || this.defaultModels.chat,
      messages: formattedMessages,
      stream: false,
    };

    if (format) {
      payload.format = format;
    }
    if (Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
    }

    const optionsObj = {};
    if (temperature !== undefined && temperature !== null && !isNaN(temperature)) {
      optionsObj.temperature = Number(temperature);
    }
    if (maxTokens !== undefined && maxTokens !== null && !isNaN(maxTokens)) {
      optionsObj.num_predict = parseInt(maxTokens, 10);
    }
    if (topP !== undefined && topP !== null && !isNaN(topP)) {
      optionsObj.top_p = Number(topP);
    }
    if (stop) {
      optionsObj.stop = Array.isArray(stop) ? stop : [String(stop)];
    }
    if (Object.keys(optionsObj).length > 0) {
      payload.options = optionsObj;
    }

    const res = await this.executeWithRetry(() =>
      httpClient({
        method: 'POST',
        url: endpoint,
        headers: this._getHeaders(apiKey),
        data: payload,
        timeout,
      })
    );

    const text = res.data?.message?.content || '';
    const finishReason = res.data?.done_reason || (res.data?.done ? 'stop' : 'unknown');
    const promptTokens = res.data?.prompt_eval_count || 0;
    const completionTokens = res.data?.eval_count || 0;

    const rawToolCalls = res.data?.message?.tool_calls || [];
    const toolCalls = rawToolCalls.map((tc, idx) => ({
      id: tc.id || `call_ollama_${idx}`,
      name: tc.function?.name || tc.name,
      arguments: tc.function?.arguments || tc.arguments || {},
    }));

    return {
      text,
      content: text,
      toolCalls,
      provider: this.id,
      model: res.data?.model || payload.model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason,
      raw: res.data,
    };
  }

  async generate(options = {}) {
    this.validateCapability('generate');
    const { prompt, systemPrompt, ...rest } = options;
    const messages = [{ role: 'user', content: String(prompt || '') }];
    return this.chat({
      ...rest,
      systemPrompt,
      messages,
      model: options.model || this.defaultModels.generate,
    });
  }

  async structuredOutput(options = {}) {
    this.validateCapability('structured');
    const { prompt, schema, systemPrompt, ...rest } = options;

    let parsedSchema = schema;
    if (typeof schema === 'string') {
      try {
        parsedSchema = JSON.parse(schema);
      } catch (err) {
        throw new NodeExecutionError(`Invalid JSON Schema for structured output: ${err.message}`);
      }
    }

    const schemaInstruction = `Output pure JSON strictly adhering to schema:\n${JSON.stringify(parsedSchema, null, 2)}`;
    const enrichedSystem = systemPrompt
      ? `${systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem,
      messages: [{ role: 'user', content: String(prompt || '') }],
      format: 'json',
      model: options.model || this.defaultModels.structured,
    });

    let cleaned = chatRes.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let structured = null;
    try {
      structured = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new NodeExecutionError(
        `Failed to parse structured JSON output from Ollama: ${parseErr.message}. Output was: "${chatRes.text}"`
      );
    }

    return {
      ...chatRes,
      text: cleaned,
      content: cleaned,
      structured,
    };
  }

  async classify(options = {}) {
    this.validateCapability('classify');
    const { input, categories = [], systemPrompt = '', ...rest } = options;

    let targetCategories = categories;
    if (typeof categories === 'string') {
      targetCategories = categories.split(',').map((c) => c.trim()).filter(Boolean);
    }

    if (!Array.isArray(targetCategories) || targetCategories.length < 2) {
      throw new NodeExecutionError('Classification requires at least two target categories');
    }

    const classificationInstructions = `You are a text classifier. Classify the user input into EXACTLY ONE of these categories:
${JSON.stringify(targetCategories)}

Respond with JSON only:
{"category": "<one_of_the_categories>", "confidence": 0.0 to 1.0}`;

    const enrichedSystem = systemPrompt
      ? `${systemPrompt}\n\n${classificationInstructions}`
      : classificationInstructions;

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem,
      messages: [{ role: 'user', content: String(input || '') }],
      format: 'json',
      temperature: options.temperature ?? 0,
      model: options.model || this.defaultModels.classify,
    });

    let cleaned = chatRes.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let category = '';
    let confidence = 1.0;
    try {
      const parsed = JSON.parse(cleaned);
      const rawCat = parsed.category || parsed.label || parsed.class || '';
      const matched = targetCategories.find(
        (c) => c.toLowerCase().trim() === String(rawCat).toLowerCase().trim()
      );
      category = matched || rawCat;
      if (parsed.confidence !== undefined && !isNaN(parsed.confidence)) {
        confidence = Number(parsed.confidence);
      }
    } catch {
      const textLower = chatRes.text.toLowerCase();
      const matched = targetCategories.find((c) => textLower.includes(c.toLowerCase()));
      category = matched || targetCategories[0];
    }

    return {
      ...chatRes,
      category,
      confidence,
    };
  }

  async embeddings(options = {}) {
    this.validateCapability('embeddings');
    const { input, model, apiKey, baseUrl, timeout = 30000, httpClient = axios } = options;

    if (!input || !String(input).trim()) {
      throw new NodeExecutionError('Input text is required for generating embeddings');
    }

    const base = (baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
    const modelName = model || this.defaultModels.embeddings;

    let res;
    try {
      // First try /api/embeddings (standard in most Ollama installations)
      res = await this.executeWithRetry(() =>
        httpClient({
          method: 'POST',
          url: `${base}/api/embeddings`,
          headers: this._getHeaders(apiKey),
          data: { model: modelName, prompt: String(input) },
          timeout,
        })
      );
    } catch (err) {
      if (err.statusCode === 404) {
        // Fallback to /api/embed
        res = await this.executeWithRetry(() =>
          httpClient({
            method: 'POST',
            url: `${base}/api/embed`,
            headers: this._getHeaders(apiKey),
            data: { model: modelName, input: String(input) },
            timeout,
          })
        );
      } else {
        throw err;
      }
    }

    let embedding = [];
    if (Array.isArray(res.data?.embedding)) {
      embedding = res.data.embedding;
    } else if (Array.isArray(res.data?.embeddings) && res.data.embeddings.length > 0) {
      embedding = res.data.embeddings[0];
    }

    const promptTokens = res.data?.prompt_eval_count || 0;

    return {
      text: '',
      content: '',
      embedding,
      dimensions: embedding.length,
      provider: this.id,
      model: res.data?.model || modelName,
      usage: {
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
      },
      finishReason: 'stop',
      raw: res.data,
    };
  }
}

module.exports = OllamaProvider;

