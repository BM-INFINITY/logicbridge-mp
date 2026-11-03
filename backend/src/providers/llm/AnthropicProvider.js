const axios = require('axios');
const { LLMProvider } = require('./LLMProvider');
const { NodeExecutionError } = require('../../errors');

class AnthropicProvider extends LLMProvider {
  constructor(options = {}) {
    super({
      id: options.id || 'anthropic',
      name: options.name || 'Anthropic',
      defaultBaseUrl: options.defaultBaseUrl || 'https://api.anthropic.com/v1',
      capabilities: options.capabilities || ['generate', 'chat', 'structured', 'classify'], // No embeddings
      defaultModels: options.defaultModels || {
        chat: 'claude-3-5-sonnet-20241022',
        generate: 'claude-3-5-sonnet-20241022',
        structured: 'claude-3-5-sonnet-20241022',
        classify: 'claude-3-5-haiku-20241022',
      },
    });
  }

  _getHeaders(apiKey) {
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (apiKey) {
      headers['x-api-key'] = apiKey;
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
  } = {}) {
    this.validateCapability('chat');
    const endpoint = `${(baseUrl || this.defaultBaseUrl).replace(/\/+$/, '')}/messages`;

    const formattedMessages = [];
    if (Array.isArray(messages)) {
      messages.forEach((m) => {
        if (typeof m === 'string') {
          formattedMessages.push({ role: 'user', content: m });
        } else if (m && typeof m === 'object') {
          const role = m.role === 'assistant' ? 'assistant' : 'user';
          formattedMessages.push({
            role,
            content: typeof m.content === 'object' ? JSON.stringify(m.content) : String(m.content || ''),
          });
        }
      });
    }

    if (formattedMessages.length === 0) {
      formattedMessages.push({ role: 'user', content: 'Hello' });
    }

    const payload = {
      model: model || this.defaultModels.chat,
      max_tokens: parseInt(maxTokens, 10) || 1024,
      messages: formattedMessages,
    };

    if (systemPrompt && String(systemPrompt).trim()) {
      payload.system = String(systemPrompt).trim();
    }
    if (temperature !== undefined && temperature !== null && !isNaN(temperature)) {
      payload.temperature = Number(temperature);
    }
    if (topP !== undefined && topP !== null && !isNaN(topP)) {
      payload.top_p = Number(topP);
    }
    if (stop) {
      payload.stop_sequences = Array.isArray(stop) ? stop : [String(stop)];
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

    const text = res.data?.content?.find((c) => c.type === 'text')?.text || '';
    const finishReason = res.data?.stop_reason || 'stop';
    const inputTokens = res.data?.usage?.input_tokens || 0;
    const outputTokens = res.data?.usage?.output_tokens || 0;

    return {
      text,
      content: text,
      provider: this.id,
      model: res.data?.model || payload.model,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
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

    const schemaInstruction = `You must respond with valid, parseable JSON conforming strictly to this schema:
${JSON.stringify(parsedSchema, null, 2)}
Output PURE JSON ONLY. Do not enclose in markdown codeblocks and do not include explanations.`;

    const enrichedSystem = systemPrompt
      ? `${systemPrompt}\n\n${schemaInstruction}`
      : schemaInstruction;

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem,
      messages: [{ role: 'user', content: String(prompt || '') }],
      model: options.model || this.defaultModels.structured,
    });

    // Strip markdown code fences if present (e.g. ```json ... ```)
    let cleaned = chatRes.text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let structured = null;
    try {
      structured = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new NodeExecutionError(
        `Failed to parse structured JSON output from Anthropic: ${parseErr.message}. Output was: "${chatRes.text}"`
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

Respond with pure JSON only in the exact format:
{"category": "<one_of_the_above_categories>", "confidence": 0.0 to 1.0}`;

    const enrichedSystem = systemPrompt
      ? `${systemPrompt}\n\n${classificationInstructions}`
      : classificationInstructions;

    const chatRes = await this.chat({
      ...rest,
      systemPrompt: enrichedSystem,
      messages: [{ role: 'user', content: String(input || '') }],
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
    this.validateCapability('embeddings'); // Throws NodeExecutionError: Anthropic does not support embeddings
  }
}

module.exports = AnthropicProvider;

