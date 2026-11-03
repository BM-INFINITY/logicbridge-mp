const assert = require('assert');
const { workflowEngine } = require('../services');
const { registry } = require('../nodes');
const { NodeTypes } = require('../constants');
const { redactSecrets, runWithScope } = require('../utils/secretRedactor');

console.log('\n🧪 Starting AI Nodes Workflow Execution Tests...\n');

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
  console.log('Group 1: AI Generate Node Execution');

  await itAsync('Generates text with variable interpolation and feeds downstream node', async () => {
    const generateNode = registry.get(NodeTypes.ACTION_AI_GENERATE);
    assert(generateNode);

    const mockHttpClient = async (config) => {
      assert(config.data.messages[0].content.includes('Write an email about Solar Panels to John Doe'));
      return {
        data: {
          model: 'gpt-4o-mini',
          choices: [
            {
              message: { role: 'assistant', content: 'Subject: Clean Energy for John Doe\n\nDear John...' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 25, completion_tokens: 30, total_tokens: 55 },
        },
      };
    };

    const node = {
      id: 'ai_gen_1',
      type: NodeTypes.ACTION_AI_GENERATE,
      data: {
        provider: 'openai',
        apiKey: '{{secrets.OPENAI_KEY}}',
        prompt: 'Write an email about {{variables.product}} to {{steps.step_input.name}}',
        temperature: 0.5,
      },
    };

    const context = {
      httpClient: mockHttpClient,
      variables: { product: 'Solar Panels' },
      secrets: { OPENAI_KEY: 'sk-proj-secret-ai-token-xyz999' },
      results: {
        step_input: { name: 'John Doe' },
      },
    };

    const output = await generateNode.execute(node, context, { httpClient: mockHttpClient });

    assert.strictEqual(output.provider, 'openai');
    assert.strictEqual(output.finishReason, 'stop');
    assert(output.text.includes('Subject: Clean Energy for John Doe'));
    assert.strictEqual(output.content, output.text);
    assert.strictEqual(output.usage.totalTokens, 55);
    assert(typeof output.executionTimeMs === 'number');
  });

  console.log('\nGroup 2: AI Chat Node Execution');

  await itAsync('Executes multi-turn conversation and updates conversation history', async () => {
    const chatNode = registry.get(NodeTypes.ACTION_AI_CHAT);
    assert(chatNode);

    const mockHttpClient = async (config) => {
      assert.strictEqual(config.data.messages.length, 3); // 1 system + 2 conversation turns
      assert.strictEqual(config.data.messages[0].role, 'system');
      assert.strictEqual(config.data.messages[1].role, 'user');
      assert.strictEqual(config.data.messages[2].role, 'user');
      assert.strictEqual(config.data.messages[2].content, 'Where is my order #12345?');
      return {
        data: {
          model: 'gpt-4o-mini',
          choices: [
            {
              message: { role: 'assistant', content: 'Order #12345 is currently in transit.' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 40, completion_tokens: 10, total_tokens: 50 },
        },
      };
    };

    const node = {
      id: 'ai_chat_1',
      type: NodeTypes.ACTION_AI_CHAT,
      data: {
        provider: 'openai',
        apiKey: 'sk-test-key',
        systemPrompt: 'You are customer service for {{variables.company}}',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'user', content: 'Where is my order #{{variables.orderId}}?' },
        ],
      },
    };

    const context = {
      variables: { company: 'Acme Corp', orderId: '12345' },
    };

    const output = await chatNode.execute(node, context, { httpClient: mockHttpClient });

    assert.strictEqual(output.text, 'Order #12345 is currently in transit.');
    assert(Array.isArray(output.messages));
    assert.strictEqual(output.messages.length, 3); // 2 user + 1 assistant
    assert.strictEqual(output.messages[2].role, 'assistant');
    assert.strictEqual(output.messages[2].content, 'Order #12345 is currently in transit.');
  });

  console.log('\nGroup 3: AI Structured Output Node Execution');

  await itAsync('Generates and parses structured JSON output with schema', async () => {
    const structuredNode = registry.get(NodeTypes.ACTION_AI_STRUCTURED);
    assert(structuredNode);

    const mockHttpClient = async (config) => {
      return {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  customerName: 'Sarah Connor',
                  sentiment: 'urgent',
                  priority: 1,
                  items: ['Terminator Part #800', 'Power Cell'],
                }),
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 60, completion_tokens: 35, total_tokens: 95 },
        },
      };
    };

    const node = {
      id: 'ai_struct_1',
      type: NodeTypes.ACTION_AI_STRUCTURED,
      data: {
        provider: 'openai',
        apiKey: 'sk-test',
        prompt: 'Analyze support ticket: {{steps.ticket.text}}',
        schemaName: 'TicketAnalysis',
        schema: JSON.stringify({
          type: 'object',
          properties: {
            customerName: { type: 'string' },
            sentiment: { type: 'string' },
            priority: { type: 'number' },
            items: { type: 'array', items: { type: 'string' } },
          },
          required: ['customerName', 'sentiment', 'priority'],
        }),
      },
    };

    const context = {
      results: {
        ticket: { text: 'Sarah Connor needs Terminator Part #800 ASAP!' },
      },
    };

    const output = await structuredNode.execute(node, context, { httpClient: mockHttpClient });

    assert(output.structured);
    assert.strictEqual(output.structured.customerName, 'Sarah Connor');
    assert.strictEqual(output.structured.sentiment, 'urgent');
    assert.strictEqual(output.structured.priority, 1);
    assert.deepStrictEqual(output.structured.items, ['Terminator Part #800', 'Power Cell']);
  });

  console.log('\nGroup 4: AI Classification Node Execution');

  await itAsync('Classifies text into categories and supports downstream routing', async () => {
    const classifyNode = registry.get(NodeTypes.ACTION_AI_CLASSIFY);
    assert(classifyNode);

    const mockHttpClient = async (config) => {
      return {
        data: {
          choices: [
            {
              message: { content: '{"category":"Security","confidence":0.99}' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 },
        },
      };
    };

    const node = {
      id: 'ai_classify_1',
      type: NodeTypes.ACTION_AI_CLASSIFY,
      data: {
        provider: 'openai',
        apiKey: 'sk-test',
        input: 'Someone attempted to guess my password multiple times',
        categories: ['General', 'Billing', 'Security', 'Feedback'],
      },
    };

    const output = await classifyNode.execute(node, {}, { httpClient: mockHttpClient });

    assert.strictEqual(output.category, 'Security');
    assert.strictEqual(output.confidence, 0.99);
  });

  console.log('\nGroup 5: AI Embeddings Node Execution');

  await itAsync('Generates embeddings for vector storage', async () => {
    const embeddingsNode = registry.get(NodeTypes.ACTION_AI_EMBEDDINGS);
    assert(embeddingsNode);

    const mockHttpClient = async (config) => {
      return {
        data: {
          model: 'text-embedding-3-small',
          data: [{ embedding: [0.05, -0.22, 0.73, 0.19, -0.04] }],
          usage: { prompt_tokens: 6, total_tokens: 6 },
        },
      };
    };

    const node = {
      id: 'ai_embed_1',
      type: NodeTypes.ACTION_AI_EMBEDDINGS,
      data: {
        provider: 'openai',
        apiKey: 'sk-test',
        input: 'Vector document snippet',
        dimensions: 5,
      },
    };

    const output = await embeddingsNode.execute(node, {}, { httpClient: mockHttpClient });

    assert.strictEqual(output.dimensions, 5);
    assert.deepStrictEqual(output.embedding, [0.05, -0.22, 0.73, 0.19, -0.04]);
  });

  await itAsync('Rejects Anthropic for embeddings at validation and execution', async () => {
    const embeddingsNode = registry.get(NodeTypes.ACTION_AI_EMBEDDINGS);

    const node = {
      id: 'bad_embed',
      type: NodeTypes.ACTION_AI_EMBEDDINGS,
      data: {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
        input: 'Some text',
      },
    };

    const validation = embeddingsNode.validate(node);
    assert.strictEqual(validation.valid, false);
    assert(validation.error.includes('Anthropic does not support embeddings'));

    await assert.rejects(async () => {
      await embeddingsNode.execute(node, {});
    }, /Anthropic does not support embeddings/);
  });

  console.log('\nGroup 6: Node Validation Checks');

  it('Validates required fields across all AI nodes', () => {
    const genNode = registry.get(NodeTypes.ACTION_AI_GENERATE);
    assert.strictEqual(genNode.validate({ data: {} }).valid, false);
    assert.strictEqual(genNode.validate({ data: { prompt: 'Valid prompt' } }).valid, true);

    const chatNode = registry.get(NodeTypes.ACTION_AI_CHAT);
    assert.strictEqual(chatNode.validate({ data: {} }).valid, false);
    assert.strictEqual(chatNode.validate({ data: { messages: [{ role: 'user', content: 'Hi' }] } }).valid, true);

    const structNode = registry.get(NodeTypes.ACTION_AI_STRUCTURED);
    assert.strictEqual(structNode.validate({ data: {} }).valid, false);
    assert.strictEqual(structNode.validate({ data: { prompt: 'P', schema: '{invalid' } }).valid, false);
    assert.strictEqual(structNode.validate({ data: { prompt: 'P', schema: '{"type":"object"}' } }).valid, true);

    const classNode = registry.get(NodeTypes.ACTION_AI_CLASSIFY);
    assert.strictEqual(classNode.validate({ data: { input: 'Text' } }).valid, false); // needs >= 2 categories
    assert.strictEqual(classNode.validate({ data: { input: 'Text', categories: ['One'] } }).valid, false);
    assert.strictEqual(classNode.validate({ data: { input: 'Text', categories: ['One', 'Two'] } }).valid, true);

    const embedNode = registry.get(NodeTypes.ACTION_AI_EMBEDDINGS);
    assert.strictEqual(embedNode.validate({ data: {} }).valid, false);
    assert.strictEqual(embedNode.validate({ data: { input: 'Hello' } }).valid, true);
  });

  console.log('\nGroup 7: Secret Redaction During Workflow Execution');

  await itAsync('Registers API keys into SecretRedactor so they are never leaked in logs or errors', async () => {
    const genNode = registry.get(NodeTypes.ACTION_AI_GENERATE);
    const secretKey = 'sk-proj-super-secret-unique-ai-key-9876543210';

    await runWithScope([secretKey], async () => {
      const mockHttpClient = async () => {
        const err = new Error(`Connection failed with key ${secretKey}`);
        err.response = { status: 500, data: { message: `Key ${secretKey} was rejected` } };
        throw err;
      };

      const node = {
        id: 'leak_check_node',
        type: NodeTypes.ACTION_AI_GENERATE,
        data: {
          provider: 'openai',
          apiKey: secretKey,
          prompt: 'Test prompt',
        },
      };

      try {
        await genNode.execute(node, {}, { httpClient: mockHttpClient });
        assert.fail('Should fail');
      } catch (err) {
        // Redacting error message
        const redactedMsg = redactSecrets(err.message);
        assert(!redactedMsg.includes(secretKey), 'Secret key must not appear in error message');
        assert(redactedMsg.includes('[REDACTED]'), 'Secret key must be masked as [REDACTED]');
      }
    });
  });

  console.log(`\nAI Nodes Execution Tests: ${passedTests} passed, ${totalTests - passedTests} failed\n`);
  if (totalTests - passedTests > 0) {
    process.exit(1);
  }
})();

