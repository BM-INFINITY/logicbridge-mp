const { GoogleGenerativeAI } = require('@google/generative-ai');

const NODE_CATALOG = `
Available node types for LogicBridge workflows:
TRIGGERS (starting nodes):
- trigger-manual: Manual trigger (user clicks run)
- trigger-schedule: Scheduled trigger (cron expression)
- trigger-webhook: Webhook trigger (HTTP POST from external service)

ACTIONS:
- action-http: HTTP Request (fields: url, method, headers, body)
- action-log: Log Output (fields: message)
- action-delay: Delay/Wait (fields: seconds)
- action-transform: Transform Data (fields: template JSON string)
- action-email: Send Email (fields: to, subject, body)

LOGIC:
- logic-condition: If/Condition gate (fields: leftValue, operator, rightValue)
`;

const SYSTEM_PROMPT = `You are a workflow automation assistant for LogicBridge platform.
Given a user description, generate a workflow as JSON with this exact structure:
{
  "name": "workflow name",
  "description": "brief description",
  "nodes": [
    {
      "id": "node_1",
      "type": "trigger-manual",
      "position": { "x": 100, "y": 200 },
      "data": { "label": "Start", ...other fields }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node_1", "target": "node_2", "animated": true }
  ]
}

Rules:
- Always start with exactly one trigger node at position x:100
- Space nodes horizontally by 250px increments
- Center nodes vertically around y:200
- All nodes must be connected with edges
- Use only the available node types from the catalog
- Keep it practical and executable

${NODE_CATALOG}

Return ONLY valid JSON, no explanation, no markdown code fences.`;

async function generate(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return a demo workflow if no API key
    return getDemoWorkflow(userPrompt);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(
      `${SYSTEM_PROMPT}\n\nUser description: ${userPrompt}`
    );
    const text = result.response.text();

    // Strip markdown fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const workflow = JSON.parse(cleaned);
    return workflow;
  } catch (err) {
    console.error('AI generation error:', err.message);
    // Fallback to demo
    return getDemoWorkflow(userPrompt);
  }
}

function getDemoWorkflow(prompt) {
  return {
    name: `AI: ${prompt.slice(0, 40)}...`,
    description: `Auto-generated workflow for: ${prompt}`,
    nodes: [
      {
        id: 'node_1',
        type: 'trigger-manual',
        position: { x: 100, y: 200 },
        data: { label: 'Manual Trigger' },
      },
      {
        id: 'node_2',
        type: 'action-http',
        position: { x: 350, y: 200 },
        data: { label: 'Fetch Data', url: 'https://api.example.com/data', method: 'GET' },
      },
      {
        id: 'node_3',
        type: 'logic-condition',
        position: { x: 600, y: 200 },
        data: { label: 'Check Result', leftValue: '200', operator: 'equals', rightValue: '200' },
      },
      {
        id: 'node_4',
        type: 'action-log',
        position: { x: 850, y: 200 },
        data: { label: 'Log Success', message: 'Workflow completed successfully' },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'node_1', target: 'node_2', animated: true },
      { id: 'e2-3', source: 'node_2', target: 'node_3', animated: true },
      { id: 'e3-4', source: 'node_3', target: 'node_4', animated: true },
    ],
  };
}

module.exports = { generate };
