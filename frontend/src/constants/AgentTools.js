/**
 * AgentTools.js
 * Canonical catalog of authorized agent tools, category definitions, and providers.
 */

export const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
  { value: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { value: 'anthropic', label: 'Anthropic (Claude)', defaultBaseUrl: 'https://api.anthropic.com/v1' },
  { value: 'ollama', label: 'Ollama (Local)', defaultBaseUrl: 'http://localhost:11434' },
];

export const SUGGESTED_MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-8b-instruct'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  ollama: ['llama3', 'mistral', 'qwen2.5'],
};

export const AVAILABLE_TOOLS = [
  {
    id: 'http_request',
    name: 'HTTP Request',
    categoryGroup: 'network',
    categoryLabel: 'Network & APIs',
    description: 'Execute GET/POST/PUT/DELETE web requests to external APIs',
    sensitive: false,
  },
  {
    id: 'transform_data',
    name: 'Transform Data',
    categoryGroup: 'data',
    categoryLabel: 'Data & Storage',
    description: 'Map, extract, or pick fields from JSON objects and arrays',
    sensitive: false,
  },
  {
    id: 'file_storage',
    name: 'File Storage',
    categoryGroup: 'data',
    categoryLabel: 'Data & Storage',
    description: 'Read and write sandboxed files in workspace (write is sensitive)',
    sensitive: false,
  },
  {
    id: 'json_utility',
    name: 'JSON Utility',
    categoryGroup: 'utility',
    categoryLabel: 'Utilities',
    description: 'Parse, stringify, get, or set nested JSON properties',
    sensitive: false,
  },
  {
    id: 'text_utility',
    name: 'Text Utility',
    categoryGroup: 'utility',
    categoryLabel: 'Utilities',
    description: 'Case conversion, find/replace, substring, and trimming',
    sensitive: false,
  },
  {
    id: 'math_utility',
    name: 'Math Utility',
    categoryGroup: 'utility',
    categoryLabel: 'Utilities',
    description: 'Calculations: add, subtract, multiply, divide, round, power',
    sensitive: false,
  },
  {
    id: 'date_utility',
    name: 'Date Utility',
    categoryGroup: 'utility',
    categoryLabel: 'Utilities',
    description: 'Current timestamp, format date, diff, time add/subtract',
    sensitive: false,
  },
  {
    id: 'database_query',
    name: 'Database Query',
    categoryGroup: 'integration',
    categoryLabel: 'Integrations',
    description: 'Query PostgreSQL or MongoDB collections (mutations are sensitive)',
    sensitive: false,
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    categoryGroup: 'integration',
    categoryLabel: 'Integrations',
    description: 'Read or append rows in spreadsheets (append is sensitive)',
    sensitive: false,
  },
  {
    id: 'slack_message',
    name: 'Slack Message',
    categoryGroup: 'integration',
    categoryLabel: 'Integrations',
    description: 'Send messages or query Slack channels',
    sensitive: true,
  },
  {
    id: 'discord_message',
    name: 'Discord Message',
    categoryGroup: 'integration',
    categoryLabel: 'Integrations',
    description: 'Post messages or alerts to Discord channels',
    sensitive: true,
  },
];

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'utility', label: 'Utilities' },
  { id: 'network', label: 'Network' },
  { id: 'data', label: 'Data & Storage' },
  { id: 'integration', label: 'Integrations' },
];

