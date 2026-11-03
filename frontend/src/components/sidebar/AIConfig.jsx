import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Key, Sliders } from 'lucide-react';
import { TextField, SelectField, CodeEditor, NumberField } from '../forms';
import SidebarSection from './SidebarSection';

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

  const handleCategoryChange = (index, value) => {
    const updated = [...categories];
    updated[index] = value;
    handleFieldChange('categories', updated);
  };

  const handleRemoveCategory = (index) => {
    if (categories.length <= 2) return;
    const updated = categories.filter((_, i) => i !== index);
    handleFieldChange('categories', updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
      {/* ── 1. Provider Selector ───────────────────────────────────────────── */}
      <SelectField
        label="LLM Provider"
        required
        value={provider}
        onChange={(nextProv) => {
          const defaultModel = SUGGESTED_MODELS[nextProv]?.[0] || '';
          onChange({
            ...data,
            provider: nextProv,
            model: isEmbeddings && nextProv === 'ollama' ? 'nomic-embed-text' : defaultModel,
          });
        }}
        options={filteredProviders}
        helperText={
          isEmbeddings && provider === 'anthropic'
            ? 'Anthropic does not offer standalone embeddings. Please switch to OpenAI, OpenRouter, or Ollama.'
            : undefined
        }
      />

      {/* ── 2. Model Selection ─────────────────────────────────────────────── */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 2,
            minWidth: 0,
          }}
        >
          <label
            className="form-label"
            style={{
              margin: 0,
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            Model Name
          </label>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            e.g. {SUGGESTED_MODELS[provider]?.[0] || 'gpt-4o-mini'}
          </span>
        </div>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            list="ai-model-suggestions"
            value={data.model || ''}
            onChange={(e) => handleFieldChange('model', e.target.value)}
            placeholder="Select or enter model identifier..."
            className="form-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              fontSize: '0.8rem',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm, 8px)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
          <datalist id="ai-model-suggestions">
            {currentModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {/* ── 3. Authentication & Endpoint ─────────────────────────────────── */}
      <SidebarSection
        title="Authentication & Endpoint"
        icon={<Key size={13} />}
        collapsible
        defaultOpen={true}
      >
        {provider !== 'ollama' && (
          <TextField
            label="API Key / Secret Expression"
            placeholder="{{secrets.OPENAI_API_KEY}} or sk-..."
            type="password"
            value={data.apiKey || ''}
            onChange={(val) => handleFieldChange('apiKey', val)}
            onInsertVariable={() =>
              onOpenVariablePicker && onOpenVariablePicker((val) => handleFieldChange('apiKey', val))
            }
            helperText="Recommended: Use {{secrets.KEY}} to keep keys encrypted and redacted."
          />
        )}

        <TextField
          label={`Base URL ${provider === 'ollama' ? '(Default: http://localhost:11434)' : '(Optional Custom Proxy)'}`}
          placeholder={
            provider === 'ollama'
              ? 'http://localhost:11434'
              : PROVIDER_OPTIONS.find((p) => p.value === provider)?.defaultBaseUrl || ''
          }
          value={data.baseUrl || ''}
          onChange={(val) => handleFieldChange('baseUrl', val)}
        />
      </SidebarSection>

      {/* ── 4. Node-Specific Fields ────────────────────────────────────────── */}

      {/* 4a. AI Generate */}
      {isGenerate && (
        <>
          <CodeEditor
            label="System Instructions (Optional)"
            placeholder="e.g. You are an expert copywriter and tone specialist."
            value={data.systemPrompt || ''}
            onChange={(val) => handleFieldChange('systemPrompt', val)}
            onInsertVariable={() =>
              onOpenVariablePicker &&
              onOpenVariablePicker((val) => handleFieldChange('systemPrompt', (data.systemPrompt || '') + val))
            }
            minLines={2}
          />
          <CodeEditor
            label="Prompt Template"
            required
            placeholder="Write a concise email summary of {{steps.trigger.body.message}}..."
            value={data.prompt || ''}
            onChange={(val) => handleFieldChange('prompt', val)}
            onInsertVariable={() =>
              onOpenVariablePicker &&
              onOpenVariablePicker((val) => handleFieldChange('prompt', (data.prompt || '') + val))
            }
            minLines={4}
            helperText="Supports Handlebars expressions like {{steps.prev.data}}."
          />
        </>
      )}

      {/* 4b. AI Chat */}
      {isChat && (
        <>
          <CodeEditor
            label="System Prompt"
            placeholder="e.g. You are a helpful customer support agent for LogicBridge."
            value={data.systemPrompt || ''}
            onChange={(val) => handleFieldChange('systemPrompt', val)}
            onInsertVariable={() =>
              onOpenVariablePicker &&
              onOpenVariablePicker((val) => handleFieldChange('systemPrompt', (data.systemPrompt || '') + val))
            }
            minLines={2}
          />

          <div className="form-group" style={{ width: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                className="form-label"
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Conversation Messages
              </label>
              <button
                type="button"
                onClick={handleAddMessage}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Plus size={11} /> Add Message
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm, 6px)',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <select
                      value={msg.role || 'user'}
                      onChange={(e) => handleMessageChange(idx, 'role', e.target.value)}
                      style={{
                        fontSize: '0.72rem',
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <option value="system">system</option>
                      <option value="user">user</option>
                      <option value="assistant">assistant</option>
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenVariablePicker &&
                          onOpenVariablePicker((val) => handleMessageChange(idx, 'content', (msg.content || '') + val))
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-primary)',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                        }}
                      >
                        + Variable
                      </button>
                      {messages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMessage(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-danger)',
                            cursor: 'pointer',
                            padding: 2,
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={msg.content || ''}
                    onChange={(e) => handleMessageChange(idx, 'content', e.target.value)}
                    placeholder={`Message content for ${msg.role}...`}
                    className="form-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                      borderRadius: 4,
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 4c. AI Structured Output */}
      {isStructured && (
        <>
          <CodeEditor
            label="Prompt"
            required
            placeholder="Extract user information from order {{steps.trigger.body.text}}..."
            value={data.prompt || ''}
            onChange={(val) => handleFieldChange('prompt', val)}
            onInsertVariable={() =>
              onOpenVariablePicker &&
              onOpenVariablePicker((val) => handleFieldChange('prompt', (data.prompt || '') + val))
            }
            minLines={3}
          />
          <TextField
            label="Schema Name"
            placeholder="order_details"
            value={data.schemaName || ''}
            onChange={(val) => handleFieldChange('schemaName', val)}
          />
          <CodeEditor
            label="JSON Schema Definition"
            required
            placeholder={'{\n  "type": "object",\n  "properties": {\n    "name": { "type": "string" }\n  }\n}'}
            value={
              typeof data.schema === 'object'
                ? JSON.stringify(data.schema, null, 2)
                : data.schema || ''
            }
            onChange={(val) => handleFieldChange('schema', val)}
            minLines={5}
            helperText="The LLM will strictly adhere to this JSON Schema specification."
          />
        </>
      )}

      {/* 4d. AI Classification */}
      {isClassify && (
        <>
          <CodeEditor
            label="Input Text to Classify"
            required
            placeholder="Customer complaint text: {{steps.trigger.body.ticketText}}"
            value={data.input || ''}
            onChange={(val) => handleFieldChange('input', val)}
            onInsertVariable={() =>
              onOpenVariablePicker &&
              onOpenVariablePicker((val) => handleFieldChange('input', (data.input || '') + val))
            }
            minLines={3}
          />

          <div className="form-group" style={{ width: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                className="form-label"
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                }}
              >
                Target Categories (Min 2)
              </label>
              <button
                type="button"
                onClick={handleAddCategory}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Plus size={11} /> Add Category
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categories.map((cat, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    value={cat}
                    onChange={(e) => handleCategoryChange(idx, e.target.value)}
                    className="form-input"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      boxSizing: 'border-box',
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                    placeholder={`Category ${idx + 1}`}
                  />
                  {categories.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-danger)',
                        cursor: 'pointer',
                        padding: 2,
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 4e. AI Embeddings */}
      {isEmbeddings && (
        <CodeEditor
          label="Input Text for Embeddings"
          required
          placeholder="Text passage to convert into dense vector embeddings: {{steps.prev.summary}}"
          value={data.input || ''}
          onChange={(val) => handleFieldChange('input', val)}
          onInsertVariable={() =>
            onOpenVariablePicker &&
            onOpenVariablePicker((val) => handleFieldChange('input', (data.input || '') + val))
          }
          minLines={3}
          helperText="Returns a floating-point vector suitable for vector databases and semantic search."
        />
      )}

      {/* ── 5. Advanced Parameters ─────────────────────────────────────────── */}
      {!isEmbeddings && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm, 8px)',
            padding: 10,
            minWidth: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              padding: 0,
            }}
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Sliders size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>Advanced Model Parameters</span>
          </button>

          {showAdvanced && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <label
                    className="form-label"
                    style={{
                      margin: 0,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Temperature
                  </label>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {data.temperature ?? 0.7}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={data.temperature ?? 0.7}
                  onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}
                >
                  <span>Precise / Deterministic (0.0)</span>
                  <span>Creative (1.0)</span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                }}
              >
                <NumberField
                  label="Max Tokens"
                  min={1}
                  step={256}
                  value={data.maxTokens ?? 2048}
                  onChange={(val) => handleFieldChange('maxTokens', val || 2048)}
                />
                <NumberField
                  label="Timeout (ms)"
                  min={1000}
                  step={1000}
                  value={data.timeout ?? 60000}
                  onChange={(val) => handleFieldChange('timeout', val || 60000)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
