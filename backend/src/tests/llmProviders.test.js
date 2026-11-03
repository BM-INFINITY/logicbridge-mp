const assert = require('assert');
const {
  LLMProvider,
  LLMError,
  OpenAIProvider,
  OpenRouterProvider,
  AnthropicProvider,
  OllamaProvider,
  providerRegistry,
} = require('../providers/llm');
const { redactSecrets, runWithScope } = require('../utils/secretRedactor');

console.log('\n🧪 Starting LLM Provider Architecture Tests...\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  console.log('Group 1: Provider Registry & Capabilities');

  it('Resolves registered providers by key', () => {
    assert(providerRegistry.hasProvider('openai'));
    assert(providerRegistry.hasProvider('openrouter'));
    assert(providerRegistry.hasProvider('anthropic'));
    assert(providerRegistry.hasProvider('ollama'));
    assert.strictEqual(providerRegistry.getProvider('openai').id, 'openai');
    assert.strictEqual(providerRegistry.getProvider('anthropic').id, 'anthropic');
  });

  it('Rejects unknown provider with descriptive error', () => {
    assert.throws(() => {
      providerRegistry.getProvider('unknown-llm');
    }, /Unknown LLM provider "unknown-llm"/);
  });

  it('Validates capabilities accurately per provider', () => {
    const openai = providerRegistry.getProvider('openai');
    assert(openai.supports('chat'));
    assert(openai.supports('generate'));
    assert(openai.supports('structured'));
    assert(openai.supports('classify'));
    assert(openai.supports('embeddings'));

    const anthropic = providerRegistry.getProvider('anthropic');
    assert(anthropic.supports('chat'));
    assert(anthropic.supports('generate'));
    assert(anthropic.supports('structured'));
    assert(anthropic.supports('classify'));
    assert.strictEqual(anthropic.supports('embeddings'), false);

    assert.throws(() => {
      anthropic.validateCapability('embeddings');
    }, /Provider "Anthropic" does not support capability "embeddings"/);
  });

  console.log('\nGroup 2: OpenAI Provider Adapter');

  await itAsync('OpenAI chat generates standardized output format', async () => {
    const openai = new OpenAIProvider();
    const mockHttpClient = async (config) => {
      assert.strictEqual(config.method, 'POST');
      assert.strictEqual(config.url, 'https://api.openai.com/v1/chat/completions');
      assert.strictEqual(config.headers.Authorization, 'Bearer test-sk-openai-12345');
      assert.strictEqual(config.data.model, 'gpt-4o-mini');
      assert.strictEqual(config.data.messages[0].role, 'system');
      assert.strictEqual(config.data.messages[1].role, 'user');
      return {
        data: {
          model: 'gpt-4o-mini',
          choices: [
            {
              message: { role: 'assistant', content: 'Hello from OpenAI!' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
        },
      };
    };

    const res = await openai.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'Be concise',
      apiKey: 'test-sk-openai-12345',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(res.text, 'Hello from OpenAI!');
    assert.strictEqual(res.content, 'Hello from OpenAI!');
    assert.strictEqual(res.provider, 'openai');
    assert.strictEqual(res.model, 'gpt-4o-mini');
    assert.strictEqual(res.finishReason, 'stop');
    assert.strictEqual(res.usage.totalTokens, 17);
  });

  await itAsync('OpenAI structuredOutput parses and returns JSON object', async () => {
    const openai = new OpenAIProvider();
    const mockHttpClient = async (config) => {
      assert(config.data.response_format);
      return {
        data: {
          choices: [
            {
              message: { content: '{"name":"Alice","age":30,"verified":true}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        },
      };
    };

    const res = await openai.structuredOutput({
      prompt: 'Extract profile',
      schema: { type: 'object', properties: { name: { type: 'string' } } },
      apiKey: 'sk-test',
      httpClient: mockHttpClient,
    });

    assert.deepStrictEqual(res.structured, { name: 'Alice', age: 30, verified: true });
    assert.strictEqual(res.text, '{"name":"Alice","age":30,"verified":true}');
  });

  await itAsync('OpenAI classify matches target category and returns confidence', async () => {
    const openai = new OpenAIProvider();
    const mockHttpClient = async (config) => {
      return {
        data: {
          choices: [
            {
              message: { content: '{"category":"billing","confidence":0.98}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 15, completion_tokens: 8, total_tokens: 23 },
        },
      };
    };

    const res = await openai.classify({
      input: 'I was charged twice',
      categories: ['Support', 'Billing', 'Sales'],
      apiKey: 'sk-test',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(res.category, 'Billing'); // Normalized to exact case in allowed list
    assert.strictEqual(res.confidence, 0.98);
  });

  await itAsync('OpenAI embeddings returns numeric vector and dimensions', async () => {
    const openai = new OpenAIProvider();
    const mockHttpClient = async (config) => {
      assert.strictEqual(config.url, 'https://api.openai.com/v1/embeddings');
      return {
        data: {
          model: 'text-embedding-3-small',
          data: [{ embedding: [0.12, -0.45, 0.88, 0.05] }],
          usage: { prompt_tokens: 4, total_tokens: 4 },
        },
      };
    };

    const res = await openai.embeddings({
      input: 'semantic search text',
      apiKey: 'sk-test',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(res.dimensions, 4);
    assert.deepStrictEqual(res.embedding, [0.12, -0.45, 0.88, 0.05]);
    assert.strictEqual(res.finishReason, 'stop');
  });

  console.log('\nGroup 3: OpenRouter Provider Adapter');

  await itAsync('OpenRouter includes custom HTTP-Referer and X-Title headers', async () => {
    const openrouter = new OpenRouterProvider();
    let sentHeaders = null;
    const mockHttpClient = async (config) => {
      sentHeaders = config.headers;
      return {
        data: {
          choices: [{ message: { content: 'OpenRouter response' } }],
        },
      };
    };

    await openrouter.generate({
      prompt: 'Hello OpenRouter',
      apiKey: 'sk-or-test',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(sentHeaders['HTTP-Referer'], 'https://logicbridge.io');
    assert.strictEqual(sentHeaders['X-Title'], 'LogicBridge');
    assert.strictEqual(sentHeaders.Authorization, 'Bearer sk-or-test');
  });

  console.log('\nGroup 4: Anthropic Claude Provider Adapter');

  await itAsync('Anthropic formats messages, top-level system, and x-api-key header', async () => {
    const anthropic = new AnthropicProvider();
    let sentData = null;
    let sentHeaders = null;

    const mockHttpClient = async (config) => {
      sentHeaders = config.headers;
      sentData = config.data;
      return {
        data: {
          model: 'claude-3-5-sonnet-20241022',
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 15, output_tokens: 8 },
        },
      };
    };

    const res = await anthropic.chat({
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      systemPrompt: 'Be concise and accurate.',
      apiKey: 'sk-ant-test-key-12345',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(sentHeaders['x-api-key'], 'sk-ant-test-key-12345');
    assert.strictEqual(sentHeaders['anthropic-version'], '2023-06-01');
    assert.strictEqual(sentData.system, 'Be concise and accurate.');
    assert.strictEqual(sentData.max_tokens, 1024);
    assert.strictEqual(res.text, 'Hello from Claude!');
    assert.strictEqual(res.finishReason, 'end_turn');
    assert.strictEqual(res.usage.promptTokens, 15);
    assert.strictEqual(res.usage.completionTokens, 8);
    assert.strictEqual(res.usage.totalTokens, 23);
  });

  await itAsync('Anthropic structured output strips markdown codeblocks cleanly', async () => {
    const anthropic = new AnthropicProvider();
    const mockHttpClient = async () => ({
      data: {
        content: [
          {
            type: 'text',
            text: '```json\n{\n  "status": "success",\n  "code": 200\n}\n```',
          },
        ],
        stop_reason: 'end_turn',
      },
    });

    const res = await anthropic.structuredOutput({
      prompt: 'Return status',
      schema: { type: 'object' },
      apiKey: 'sk-ant-test',
      httpClient: mockHttpClient,
    });

    assert.deepStrictEqual(res.structured, { status: 'success', code: 200 });
  });

  console.log('\nGroup 5: Ollama Local Provider Adapter');

  await itAsync('Ollama chat executes locally without requiring API key', async () => {
    const ollama = new OllamaProvider();
    let sentUrl = null;
    let sentHeaders = null;

    const mockHttpClient = async (config) => {
      sentUrl = config.url;
      sentHeaders = config.headers;
      return {
        data: {
          model: 'llama3',
          message: { role: 'assistant', content: 'Local Ollama response' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 8,
          eval_count: 4,
        },
      };
    };

    const res = await ollama.chat({
      messages: [{ role: 'user', content: 'Local test' }],
      baseUrl: 'http://localhost:11434',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(sentUrl, 'http://localhost:11434/api/chat');
    assert.strictEqual(sentHeaders.Authorization, undefined); // No auth needed for local
    assert.strictEqual(res.text, 'Local Ollama response');
    assert.strictEqual(res.usage.totalTokens, 12);
  });

  await itAsync('Ollama embeddings extracts vector from /api/embeddings', async () => {
    const ollama = new OllamaProvider();
    const mockHttpClient = async (config) => {
      assert.strictEqual(config.url, 'http://localhost:11434/api/embeddings');
      return {
        data: {
          embedding: [0.01, 0.02, 0.03],
          prompt_eval_count: 5,
        },
      };
    };

    const res = await ollama.embeddings({
      input: 'Text to embed',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(res.dimensions, 3);
    assert.deepStrictEqual(res.embedding, [0.01, 0.02, 0.03]);
  });

  console.log('\nGroup 6: Rate Limiting & Retry-After Handling');

  await itAsync('Retries on HTTP 429 rate limit and respects retry-after header', async () => {
    const openai = new OpenAIProvider();
    let attempts = 0;

    const mockHttpClient = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Rate limit exceeded');
        error.response = {
          status: 429,
          headers: { 'retry-after': '1' },
          data: { error: { message: 'Too many requests' } },
        };
        throw error;
      }
      return {
        data: {
          choices: [{ message: { content: 'Succeeded on attempt 3' } }],
        },
      };
    };

    const res = await openai.generate({
      prompt: 'Retry test',
      apiKey: 'sk-test',
      httpClient: mockHttpClient,
    });

    assert.strictEqual(attempts, 3);
    assert.strictEqual(res.text, 'Succeeded on attempt 3');
  });

  console.log('\nGroup 7: Error Normalization & Timeout Handling');

  await itAsync('Normalizes 401 Authentication errors without retrying', async () => {
    const openai = new OpenAIProvider();
    let attempts = 0;

    const mockHttpClient = async () => {
      attempts++;
      const error = new Error('Unauthorized');
      error.response = {
        status: 401,
        data: { error: { message: 'Incorrect API key provided' } },
      };
      throw error;
    };

    try {
      await openai.generate({
        prompt: 'Auth test',
        apiKey: 'bad-key',
        httpClient: mockHttpClient,
      });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(attempts, 1); // Does not retry 401
      assert.strictEqual(err.statusCode, 401);
      assert(err.message.includes('Authentication failed'));
      assert(err.message.includes('Incorrect API key'));
    }
  });

  await itAsync('Normalizes request timeouts', async () => {
    const openai = new OpenAIProvider();
    const mockHttpClient = async () => {
      const error = new Error('timeout of 5000ms exceeded');
      error.code = 'ECONNABORTED';
      throw error;
    };

    try {
      await openai.generate({
        prompt: 'Timeout test',
        apiKey: 'sk-test',
        httpClient: mockHttpClient,
      });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(err.statusCode, 408);
      assert(err.message.includes('Request timed out'));
    }
  });

  console.log('\nGroup 8: Secret Redaction for LLM Keys');

  it('Redacts OpenAI sk- and Anthropic sk-ant- keys from logs and strings', () => {
    const rawLog = 'Connecting with OpenAI key sk-proj-1234567890abcdef12345678 and Claude key sk-ant-api03-abcdef1234567890abcdef12';
    const redacted = redactSecrets(rawLog);

    assert(!redacted.includes('sk-proj-1234567890abcdef12345678'));
    assert(!redacted.includes('sk-ant-api03-abcdef1234567890abcdef12'));
    assert(redacted.includes('[REDACTED]'));
  });

  console.log(`\nLLM Provider Tests: ${passedTests} passed, ${totalTests - passedTests} failed\n`);
  if (totalTests - passedTests > 0) {
    process.exit(1);
  }
})();

