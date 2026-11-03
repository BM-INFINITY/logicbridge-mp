import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Key, Sliders, Code } from 'lucide-react';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1' },
  { value: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1' },
  { value: 'anthropic', label: 'Anthropic (Claude)', defaultBaseUrl: 'https://api.anthropic.com/v1' },
  { value: 'ollama', label: 'Ollama (Local)', defaultBaseUrl: 'http://localhost:11434' },
];

const SUGGESTED_MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'text-embedding-3-small', 'text-embedding-3-large'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-8b-instruct'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  ollama: ['llama3', 'mistral', 'nomic-embed-text', 'qwen2.5'],
};

export default function AIConfig({
  nodeType = 'action-ai-generate',
  data = {},
  onChange,
  onOpenVariablePicker,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isGenerate = nodeType === 'action-ai-generate';
  const isChat = nodeType === 'action-ai-chat';
  const isStructured = nodeType === 'action-ai-structured';
  const isClassify = nodeType === 'action-ai-classify';
  const isEmbeddings = nodeType === 'action-ai-embeddings';

  const provider = data.provider || 'openai';
  const filteredProviders = isEmbeddings
    ? PROVIDER_OPTIONS.filter((p) => p.value !== 'anthropic')
    : PROVIDER_OPTIONS;

  const currentModels = SUGGESTED_MODELS[provider] || [];

  const handleFieldChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  // Messages handling for AI Chat
  const messages = Array.isArray(data.messages) ? data.messages : [{ role: 'user', content: '' }];

  const handleMessageChange = (index, field, value) => {
    const updated = [...messages];
    updated[index] = { ...updated[index], [field]: value };
    handleFieldChange('messages', updated);
  };

  const handleAddMessage = () => {
    handleFieldChange('messages', [...messages, { role: 'user', content: '' }]);
  };

  const handleRemoveMessage = (index) => {
    if (messages.length <= 1) return;
    const updated = messages.filter((_, i) => i !== index);
    handleFieldChange('messages', updated);
  };

  // Categories handling for AI Classification
  const categories = Array.isArray(data.categories)
    ? data.categories
    : typeof data.categories === 'string' && data.categories.trim()
    ? data.categories.split(',').map((c) => c.trim()).filter(Boolean)
    : ['Support', 'Sales', 'Billing', 'General'];

  const handleAddCategory = () => {
    handleFieldChange('categories', [...categories, `Category ${categories.length + 1}`]);
  };

  const handleCategoryChange = (index, val) => {
    const updated = [...categories];
    updated[index] = val;
    handleFieldChange('categories', updated);
  };

  const handleRemoveCategory = (index) => {
    if (categories.length <= 2) return;
    const updated = categories.filter((_, i) => i !== index);
    handleFieldChange('categories', updated);
  };

  return (
    <div className="space-y-4 text-xs" style={{ padding: '4px 0' }}>
      {/* Provider Selector */}
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
              model: isEmbeddings && nextProv === 'ollama' ? 'nomic-embed-text' : defaultModel,
            });
          }}
          className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
        >
          {filteredProviders.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {isEmbeddings && provider === 'anthropic' && (
          <div className="text-red-400 text-xs mt-1">
            Anthropic Claude does not offer a standalone embeddings API. Please switch to OpenAI, OpenRouter, or Ollama.
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-gray-300 font-medium">Model Name</label>
          <span className="text-gray-500 text-[10px]">e.g. gpt-4o-mini</span>
        </div>
        <div className="relative">
          <input
            type="text"
            list="model-suggestions"
            value={data.model || ''}
            onChange={(e) => handleFieldChange('model', e.target.value)}
            placeholder="Select or enter model identifier..."
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
          <datalist id="model-suggestions">
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
          <span>Authentication & Endpoint</span>
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
            <span className="text-[10px] text-gray-500 block mt-1">
              Recommended: Use <code className="text-purple-300">&#123;&#123;secrets.KEY&#125;&#125;</code> to keep API keys encrypted and redacted.
            </span>
          </div>
        )}

        <div>
          <label className="block text-gray-400 mb-1">
            Base URL {provider === 'ollama' ? '(Default: http://localhost:11434)' : '(Optional custom proxy / gateway)'}
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

      {/* Node-Specific Fields */}
      {/* 1. AI Generate */}
      {isGenerate && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">System Instructions (Optional)</label>
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
              placeholder="e.g. You are an expert copywriter and tone specialist."
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">
                Prompt Template <span className="text-red-400">*</span>
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
              placeholder="Write a summary for customer request: {{steps.previous.data}}"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>
        </div>
      )}

      {/* 2. AI Chat */}
      {isChat && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">System Prompt</label>
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
              placeholder="You are a helpful and polite assistant."
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-300 font-medium">Conversation Messages</label>
              <button
                type="button"
                onClick={handleAddMessage}
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
              >
                <Plus size={11} /> Add Message
              </button>
            </div>

            <div className="space-y-2">
              {messages.map((msg, index) => (
                <div key={index} className="p-2 border border-gray-700 rounded bg-gray-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <select
                      value={msg.role || 'user'}
                      onChange={(e) => handleMessageChange(index, 'role', e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-white"
                    >
                      <option value="user">User</option>
                      <option value="assistant">Assistant</option>
                      <option value="system">System</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenVariablePicker &&
                          onOpenVariablePicker((val) =>
                            handleMessageChange(index, 'content', (msg.content || '') + val)
                          )
                        }
                        className="text-[10px] text-purple-400 hover:text-purple-300"
                      >
                        + Variable
                      </button>
                      {messages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMessage(index)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={msg.content || ''}
                    onChange={(e) => handleMessageChange(index, 'content', e.target.value)}
                    placeholder="Enter message text or {{variable}}..."
                    className="w-full bg-gray-900 border border-gray-700 rounded p-1.5 text-white text-xs font-mono focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. AI Structured Output */}
      {isStructured && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">Prompt</label>
              <button
                type="button"
                onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('prompt', (data.prompt || '') + val))}
                className="text-[10px] text-purple-400 hover:text-purple-300"
              >
                + Variable
              </button>
            </div>
            <textarea
              rows={3}
              value={data.prompt || ''}
              onChange={(e) => handleFieldChange('prompt', e.target.value)}
              placeholder="Extract person name and age from: {{steps.prev.text}}"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">Schema Name</label>
            <input
              type="text"
              value={data.schemaName || ''}
              onChange={(e) => handleFieldChange('schemaName', e.target.value)}
              placeholder="e.g. CustomerProfile"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium flex items-center gap-1">
                <Code size={12} /> JSON Schema <span className="text-red-400">*</span>
              </label>
            </div>
            <textarea
              rows={6}
              value={typeof data.schema === 'object' ? JSON.stringify(data.schema, null, 2) : data.schema || ''}
              onChange={(e) => handleFieldChange('schema', e.target.value)}
              placeholder={'{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" }\n  }\n}'}
              className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-green-400 text-xs font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 4. AI Classification */}
      {isClassify && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">
                Input Text <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('input', (data.input || '') + val))}
                className="text-[10px] text-purple-400 hover:text-purple-300"
              >
                + Variable
              </button>
            </div>
            <textarea
              rows={3}
              value={data.input || data.text || ''}
              onChange={(e) => handleFieldChange('input', e.target.value)}
              placeholder="Text to classify: {{steps.trigger.body.message}}"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-300 font-medium">Target Categories (Min 2)</label>
              <button
                type="button"
                onClick={handleAddCategory}
                className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300"
              >
                <Plus size={11} /> Add Category
              </button>
            </div>

            <div className="space-y-1.5">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={cat}
                    onChange={(e) => handleCategoryChange(idx, e.target.value)}
                    placeholder={`Category ${idx + 1}`}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs focus:outline-none"
                  />
                  {categories.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(idx)}
                      className="text-gray-500 hover:text-red-400 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. AI Embeddings */}
      {isEmbeddings && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-gray-300 font-medium">
                Input Text <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('input', (data.input || '') + val))}
                className="text-[10px] text-purple-400 hover:text-purple-300"
              >
                + Variable
              </button>
            </div>
            <textarea
              rows={4}
              value={data.input || data.text || ''}
              onChange={(e) => handleFieldChange('input', e.target.value)}
              placeholder="Text to generate vector embeddings for..."
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-gray-300 font-medium mb-1">
              Target Dimensions (Optional)
            </label>
            <input
              type="number"
              value={data.dimensions || ''}
              onChange={(e) => handleFieldChange('dimensions', e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder="e.g. 1536"
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Advanced Parameters Accordion */}
      {!isEmbeddings && (
        <div className="border-t border-gray-800 pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white font-medium py-1 w-full text-left"
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Sliders size={13} className="text-purple-400" />
            <span>Advanced Model Parameters</span>
          </button>

          {showAdvanced && (
            <div className="mt-2 space-y-3 pl-3 border-l-2 border-purple-500/30">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-gray-400">Temperature</label>
                  <span className="text-gray-300 font-mono text-[11px]">{data.temperature ?? 0.7}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={data.temperature ?? 0.7}
                  onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Deterministic (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1">Max Tokens</label>
                  <input
                    type="number"
                    value={data.maxTokens || 1024}
                    onChange={(e) => handleFieldChange('maxTokens', parseInt(e.target.value, 10) || '')}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={data.timeout || 30000}
                    onChange={(e) => handleFieldChange('timeout', parseInt(e.target.value, 10) || 30000)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-1.5 text-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
