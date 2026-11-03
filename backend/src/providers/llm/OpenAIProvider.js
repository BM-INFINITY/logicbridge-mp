const axios = require('axios');
const { LLMProvider } = require('./LLMProvider');
const { NodeExecutionError } = require('../../errors');

class OpenAIProvider extends LLMProvider {
  constructor(options = {}) {
    super({
      id: options.id || 'openai',
      name: options.name || 'OpenAI',
      defaultBaseUrl: options.defaultBaseUrl || 'https://api.openai.com/v1',
      capabilities: options.capabilities || ['generate', 'chat', 'structured', 'classify', 'embeddings'],
      defaultModels: options.defaultModels || {
        chat: 'gpt-4o-mini',
        generate: 'gpt-4o-mini',
        structured: 'gpt-4o-mini',
        classify: 'gpt-4o-mini',
        embeddings: 'text-embedding-3-small',
      },
    });
    this.customHeaders = options.customHeaders || {};
  }

  _getHeaders(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };
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
    responseFormat,
    tools,
    toolChoice,
  } = {}) {
    this.validateCapability('chat');
    const endpoint = `${(baseUrl || this.defaultBaseUrl).replace(/\/+$/, '')}/chat/completions`;

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
              tool_call_id: m.tool_call_id || m.toolCallId || m.id,
              content: typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content || ''),
            });
          } else if (m.tool_calls || m.toolCalls) {
            formattedMessages.push({
              role: 'assistant',
              content: m.content || null,
              tool_calls: (m.tool_calls || m.toolCalls).map((tc) => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name || tc.function?.name,
                  arguments:
                    typeof tc.arguments === 'string'
                      ? tc.arguments
                      : JSON.stringify(tc.arguments || tc.function?.arguments || {}),
                },
              })),
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
    };

    if (temperature !== undefined && temperature !== null && !isNaN(temperature)) {
      payload.temperature = Number(temperature);
    }
    if (maxTokens !== undefined && maxTokens !== null && !isNaN(maxTokens)) {
      payload.max_tokens = parseInt(maxTokens, 10);
    }
    if (topP !== undefined && topP !== null && !isNaN(topP)) {
      payload.top_p = Number(topP);
    }
    if (stop) {
      payload.stop = Array.isArray(stop) ? stop : [String(stop)];
    }
    if (responseFormat) {
      payload.response_format = responseFormat;
    }
    if (Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || '',
          parameters: t.parameters || t.schema || { type: 'object' },
        },
      }));
      if (toolChoice) {
        payload.tool_choice = toolChoice;
      }
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

    const choice = res.data?.choices?.[0];
    const text = choice?.message?.content || '';

    const rawToolCalls = choice?.message?.tool_calls || [];
    const toolCalls = rawToolCalls.map((tc) => {
      let parsedArgs = {};
      try {
        parsedArgs =
          typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments || {};
      } catch {
        parsedArgs = { raw: tc.function?.arguments };
      }
      return {
        id: tc.id,
        name: tc.function?.name,
        arguments: parsedArgs,
      };
    });

    return {
      text,
      content: text,
      toolCalls,
      provider: this.id,
      model: res.data?.model || payload.model,
      usage: {
        promptTokens: res.data?.usage?.prompt_tokens || 0,
        completionTokens: res.data?.usage?.completion_tokens || 0,
        totalTokens: res.data?.usage?.total_tokens || 0,
      },
      finishReason: choice?.finish_reason || 'stop',
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
    const { prompt, schema, schemaName = 'StructuredResult', systemPrompt, ...rest } = options;

    let parsedSchema = schema;
    if (typeof schema === 'string') {
      try {
        parsedSchema = JSON.parse(schema);
      } catch (err) {
        throw new NodeExecutionError(`Invalid JSON Schema for structured output: ${err.message}`);
      }
    }

    let responseFormat = { type: 'json_object' };
    let enrichedSystem = systemPrompt ? `${systemPrompt}\n` : '';

    if (parsedSchema && typeof parsedSchema === 'object') {
      responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: schemaName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'StructuredResult',
          strict: true,
          schema: parsedSchema,
        },
      };
      enrichedSystem += `Output valid JSON matching this schema:\n${JSON.stringify(parsedSchema, null, 2)}`;
    } else {
      enrichedSystem += 'Output pure, valid JSON object.';
    }

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem.trim(),
      messages: [{ role: 'user', content: String(prompt || '') }],
      responseFormat,
      model: options.model || this.defaultModels.structured,
    });

    let structured = null;
    try {
      structured = JSON.parse(chatRes.text);
    } catch (parseErr) {
      throw new NodeExecutionError(
        `Failed to parse structured JSON output from LLM: ${parseErr.message}. Output was: "${chatRes.text}"`
      );
    }

    return {
      ...chatRes,
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

    const classificationInstructions = `You are an accurate text classifier.
Classify the following user input into EXACTLY ONE of these categories:
${JSON.stringify(targetCategories)}

You MUST respond with a JSON object strictly conforming to:
{
  "category": "<one of the exact categories above>",
  "confidence": <number between 0.0 and 1.0>
}`;

    const enrichedSystem = systemPrompt
      ? `${systemPrompt}\n\n${classificationInstructions}`
      : classificationInstructions;

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem,
      messages: [{ role: 'user', content: String(input || '') }],
      responseFormat: { type: 'json_object' },
      temperature: options.temperature ?? 0,
      model: options.model || this.defaultModels.classify,
    });

    let category = '';
    let confidence = 1.0;
    try {
      const parsed = JSON.parse(chatRes.text);
      const rawCat = parsed.category || parsed.label || parsed.class || '';
      // Find matching category case-insensitively
      const matched = targetCategories.find(
        (c) => c.toLowerCase().trim() === String(rawCat).toLowerCase().trim()
      );
      category = matched || rawCat;
      if (parsed.confidence !== undefined && !isNaN(parsed.confidence)) {
        confidence = Number(parsed.confidence);
      }
    } catch {
      // Fallback: check if text directly mentions one of the categories
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
    const { input, model, dimensions, apiKey, baseUrl, timeout = 30000, httpClient = axios } = options;

    if (!input || !String(input).trim()) {
      throw new NodeExecutionError('Input text is required for generating embeddings');
    }

    const endpoint = `${(baseUrl || this.defaultBaseUrl).replace(/\/+$/, '')}/embeddings`;
    const payload = {
      model: model || this.defaultModels.embeddings,
      input: String(input),
    };
    if (dimensions !== undefined && dimensions !== null && !isNaN(dimensions)) {
      payload.dimensions = parseInt(dimensions, 10);
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

    const embedding = res.data?.data?.[0]?.embedding || [];

    return {
      text: '',
      content: '',
      embedding,
      dimensions: embedding.length,
      provider: this.id,
      model: res.data?.model || payload.model,
      usage: {
        promptTokens: res.data?.usage?.prompt_tokens || 0,
        completionTokens: 0,
        totalTokens: res.data?.usage?.total_tokens || 0,
      },
      finishReason: 'stop',
      raw: res.data,
    };
  }
}

module.exports = OpenAIProvider;

