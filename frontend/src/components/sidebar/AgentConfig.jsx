import React, { useState } from 'react';
import {
  Wrench,
  Shield,
  Key,
  Sliders,
  Code,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
  { value: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { value: 'anthropic', label: 'Anthropic (Claude)', defaultBaseUrl: 'https://api.anthropic.com/v1' },
  { value: 'ollama', label: 'Ollama (Local)', defaultBaseUrl: 'http://localhost:11434' },
];

const SUGGESTED_MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-8b-instruct'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  ollama: ['llama3', 'mistral', 'qwen2.5'],
};

const AVAILABLE_TOOLS = [
  {
    id: 'http_request',
    name: 'HTTP Request',
    category: 'Network',
    description: 'Execute GET/POST/PUT/DELETE web requests to APIs',
    sensitive: false,
  },
  {
    id: 'transform_data',
    name: 'Transform Data',
    category: 'Data',
    description: 'Map, extract, or pick fields from JSON objects and arrays',
    sensitive: false,
  },
  {
    id: 'json_utility',
    name: 'JSON Utility',
    category: 'Utility',
    description: 'Parse, stringify, get, or set nested JSON properties',
    sensitive: false,
  },
  {
    id: 'text_utility',
    name: 'Text Utility',
    category: 'Utility',
    description: 'Case conversion, find/replace, substring, trimming',
    sensitive: false,
  },
  {
    id: 'math_utility',
    name: 'Math Utility',
    category: 'Utility',
    description: 'Calculations: add, subtract, multiply, divide, round, power',
    sensitive: false,
  },
  {
    id: 'date_utility',
    name: 'Date Utility',
    category: 'Utility',
    description: 'Current timestamp, format date, diff, time add/subtract',
    sensitive: false,
  },
  {
    id: 'database_query',
    name: 'Database Query',
    category: 'Database',
    description: 'Query PostgreSQL or MongoDB collections (mutations are sensitive)',
    sensitive: false,
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    category: 'Database',
    description: 'Read or append rows in spreadsheets (append is sensitive)',
    sensitive: false,
  },
  {
    id: 'slack_message',
    name: 'Slack Message',
    category: 'Communication',
    description: 'Send messages or query Slack channels',
    sensitive: true,
  },
  {
    id: 'discord_message',
    name: 'Discord Message',
    category: 'Communication',
    description: 'Post messages or alerts to Discord channels',
    sensitive: true,
  },
  {
    id: 'file_storage',
    name: 'File Storage',
    category: 'Storage',
    description: 'Read and write sandboxed files in workspace (write is sensitive)',
    sensitive: false,
  },
];

export default function AgentConfig({
  data = {},
  onChange,
  onOpenVariablePicker,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSchema, setShowSchema] = useState(Boolean(data.responseSchema));

  const provider = data.provider || 'openai';
  const currentModels = SUGGESTED_MODELS[provider] || [];

  const handleFieldChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const selectedTools = Array.isArray(data.tools)
    ? data.tools
    : ['http_request', 'json_utility', 'text_utility', 'math_utility', 'date_utility'];

  const toggleTool = (toolId) => {
    let next;
    if (selectedTools.includes(toolId)) {
      next = selectedTools.filter((t) => t !== toolId);
    } else {
      next = [...selectedTools, toolId];
    }
    handleFieldChange('tools', next);
  };

  const selectAllTools = () => {
    handleFieldChange('tools', AVAILABLE_TOOLS.map((t) => t.id));
  };

  const selectUtilityTools = () => {
    handleFieldChange('tools', ['http_request', 'json_utility', 'text_utility', 'math_utility', 'date_utility']);
  };

  const deselectAllTools = () => {
    handleFieldChange('tools', []);
  };

  return (
    <div className="space-y-4 text-xs" style={{ padding: '4px 0' }}>
      {/* Provider & Model Header */}
      <div>
        <label className="block text-gray-300 font-medium mb-1">
          LLM Provider <span className="text-red-400">*</span>
        </label>
        <select
          value={provider}
          onChange={(e) => {
            const nextProv = e.target.value;
            const defaultModel = SUGGESTED_MODELS[nextProv]?.[0] || '';
            onChange({
              ...data,
              provider: nextProv,
              model: defaultModel,
            });
          }}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
        >
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-gray-300 font-medium">Model</label>
          <span className="text-gray-500 text-[10px]">e.g. gpt-4o-mini</span>
        </div>
        <div className="relative">
          <input
            type="text"
            list="agent-model-suggestions"
            value={data.model || ''}
            onChange={(e) => handleFieldChange('model', e.target.value)}
            placeholder="Select or enter model identifier..."
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
          <datalist id="agent-model-suggestions">
            {currentModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {/* Authentication & Endpoint */}
      <div className="border border-gray-800 rounded p-3 bg-gray-900/50 space-y-3">
        <div className="flex items-center gap-1.5 font-medium text-gray-300">
          <Key size={13} className="text-purple-400" />
          <span>Authentication</span>
        </div>

        {provider !== 'ollama' && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-400">API Key / Secret Expression</label>
              <button
                type="button"
                onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('apiKey', val))}
                className="text-[10px] text-purple-400 hover:text-purple-300"
              >
                + Variable
              </button>
            </div>
            <input
              type="password"
              value={data.apiKey || ''}
              onChange={(e) => handleFieldChange('apiKey', e.target.value)}
              placeholder="{{secrets.OPENAI_API_KEY}} or sk-..."
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-gray-400 mb-1">
            Base URL {provider === 'ollama' ? '(Default: http://localhost:11434)' : '(Optional custom proxy)'}
          </label>
          <input
            type="text"
            value={data.baseUrl || ''}
            onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
            placeholder={
              provider === 'ollama'
                ? 'http://localhost:11434'
                : PROVIDER_OPTIONS.find((p) => p.value === provider)?.defaultBaseUrl || ''
            }
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {/* System Instructions & User Prompt */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-gray-300 font-medium">System Instructions</label>
          <button
            type="button"
            onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('systemPrompt', (data.systemPrompt || '') + val))}
            className="text-[10px] text-purple-400 hover:text-purple-300"
          >
            + Variable
          </button>
        </div>
        <textarea
          rows={2}
          value={data.systemPrompt || ''}
          onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
          placeholder="You are an autonomous AI Agent that solves tasks step-by-step using available tools."
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-gray-300 font-medium">
            Task / Objective Prompt <span className="text-red-400">*</span>
          </label>
          <button
            type="button"
            onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('prompt', (data.prompt || '') + val))}
            className="text-[10px] text-purple-400 hover:text-purple-300"
          >
            + Variable
          </button>
        </div>
        <textarea
          rows={4}
          value={data.prompt || ''}
          onChange={(e) => handleFieldChange('prompt', e.target.value)}
          placeholder="Fetch customer data for order {{steps.trigger.orderId}} and summarize the status..."
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
        />
      </div>

      {/* Available Tools Allowlist */}
      <div className="border border-gray-800 rounded p-3 bg-gray-900/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-gray-300">
            <Wrench size={13} className="text-purple-400" />
            <span>Authorized Tools ({selectedTools.length})</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <button type="button" onClick={selectAllTools} className="text-purple-400 hover:text-purple-300">
              All
            </button>
            <span className="text-gray-600">|</span>
            <button type="button" onClick={selectUtilityTools} className="text-purple-400 hover:text-purple-300">
              Utilities
            </button>
            <span className="text-gray-600">|</span>
            <button type="button" onClick={deselectAllTools} className="text-gray-400 hover:text-gray-300">
              None
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {AVAILABLE_TOOLS.map((tool) => {
            const isChecked = selectedTools.includes(tool.id);
            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                className={`flex items-start gap-2 p-1.5 rounded cursor-pointer border transition-colors ${
                  isChecked
                    ? 'bg-purple-950/30 border-purple-800/60 text-gray-200'
                    : 'bg-gray-850 border-gray-800 text-gray-400 hover:bg-gray-800'
                }`}
              >
                <div className="mt-0.5 text-purple-400">
                  {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[11px] text-white">{tool.name}</span>
                    <span className="text-[9px] px-1 rounded bg-gray-700 text-gray-300">{tool.category}</span>
                    {tool.sensitive && (
                      <span className="text-[9px] px-1 rounded bg-amber-900/60 text-amber-300 flex items-center gap-0.5">
                        <AlertTriangle size={9} /> Sensitive
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{tool.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sensitive Actions Policy */}
      <div className="p-2.5 rounded border border-gray-800 bg-gray-900/40 space-y-1.5">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(data.allowSensitiveActions)}
            onChange={(e) => handleFieldChange('allowSensitiveActions', e.target.checked)}
            className="mt-0.5 accent-purple-500"
          />
          <div>
            <span className="font-medium text-gray-200 block text-[11px] flex items-center gap-1">
              <Shield size={12} className="text-purple-400" />
              Allow Sensitive & Mutation Actions
            </span>
            <span className="text-[10px] text-gray-400 block mt-0.5 leading-snug">
              When checked, allows the agent to send Slack/Discord messages, write files, and mutate databases. If unchecked, sensitive tool executions will be blocked.
            </span>
          </div>
        </label>
      </div>

      {/* Optional Structured Response Schema */}
      <div className="border border-gray-800 rounded p-2 bg-gray-900/30">
        <button
          type="button"
          onClick={() => setShowSchema(!showSchema)}
          className="flex items-center gap-1.5 text-gray-300 hover:text-white font-medium w-full text-left"
        >
          {showSchema ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Code size={13} className="text-purple-400" />
          <span>Structured Response Schema (Optional)</span>
        </button>

        {showSchema && (
          <div className="mt-2 space-y-1">
            <span className="text-[10px] text-gray-400 block">
              Constrain the final agent response to adhere to a JSON schema:
            </span>
            <textarea
              rows={4}
              value={
                typeof data.responseSchema === 'object'
                  ? JSON.stringify(data.responseSchema, null, 2)
                  : data.responseSchema || ''
              }
              onChange={(e) => handleFieldChange('responseSchema', e.target.value)}
              placeholder={'{\n  "type": "object",\n  "properties": {\n    "summary": { "type": "string" }\n  }\n}'}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-green-400 text-xs font-mono focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Advanced Parameters */}
      <div className="border-t border-gray-800 pt-2">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white font-medium py-1 w-full text-left"
        >
          {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Sliders size={13} className="text-purple-400" />
          <span>Execution Limits & Model Parameters</span>
        </button>

        {showAdvanced && (
          <div className="mt-2 space-y-3 pl-3 border-l-2 border-purple-500/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">Max Iterations</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={data.maxIterations ?? 10}
                  onChange={(e) => handleFieldChange('maxIterations', parseInt(e.target.value, 10) || '')}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Max Tool Calls</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={data.maxToolCalls ?? 15}
                  onChange={(e) => handleFieldChange('maxToolCalls', parseInt(e.target.value, 10) || '')}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">Timeout (ms)</label>
                <input
                  type="number"
                  value={data.timeout ?? 60000}
                  onChange={(e) => handleFieldChange('timeout', parseInt(e.target.value, 10) || 60000)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={data.maxTokens ?? 2048}
                  onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value, 10) || 2048)}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-gray-400">Temperature</label>
                <span className="text-gray-300 font-mono text-[11px]">{data.temperature ?? 0.2}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={data.temperature ?? 0.2}
                onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>Precise reasoning (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
