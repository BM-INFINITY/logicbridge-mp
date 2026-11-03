import React, { useState } from 'react';
import {
  Wrench,
  Key,
  Sliders,
  Code,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TextField, SelectField, CodeEditor, NumberField, SwitchField } from '../forms';
import SidebarSection from './SidebarSection';
import { Badge } from '../ui';

import {
  PROVIDER_OPTIONS,
  SUGGESTED_MODELS,
  AVAILABLE_TOOLS,
  CATEGORY_FILTERS,
} from '../../constants/AgentTools';
export { AVAILABLE_TOOLS };

export default function AgentConfig({
  data = {},
  onChange,
  onOpenVariablePicker,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSchema, setShowSchema] = useState(Boolean(data.responseSchema));
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');

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
    handleFieldChange(
      'tools',
      AVAILABLE_TOOLS.filter((t) => t.categoryGroup === 'utility').map((t) => t.id)
    );
  };

  const deselectAllTools = () => {
    handleFieldChange('tools', []);
  };

  const filteredTools = activeCategoryFilter === 'all'
    ? AVAILABLE_TOOLS
    : AVAILABLE_TOOLS.filter((t) => t.categoryGroup === activeCategoryFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, width: '100%' }}>
      {/* ── 1. Provider & Model ────────────────────────────────────────────── */}
      <SelectField
        label="LLM Provider"
        required
        value={provider}
        onChange={(nextProv) => {
          const defaultModel = SUGGESTED_MODELS[nextProv]?.[0] || '';
          onChange({
            ...data,
            provider: nextProv,
            model: defaultModel,
          });
        }}
        options={PROVIDER_OPTIONS}
      />

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
            list="agent-model-suggestions"
            value={data.model || ''}
            onChange={(e) => handleFieldChange('model', e.target.value)}
            placeholder="Select or type model identifier..."
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
          <datalist id="agent-model-suggestions">
            {currentModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>

      {/* ── 2. Authentication & Endpoint ─────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm, 8px)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <Key size={13} style={{ color: 'var(--accent-primary)' }} />
          <span>Authentication & Endpoint</span>
        </div>

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
            helperText="Use {{secrets.KEY}} to safely load encrypted credentials."
          />
        )}

        <TextField
          label={`Base URL ${provider === 'ollama' ? '(Default: http://localhost:11434)' : '(Optional Custom Proxy)'}`}
          placeholder={
            provider === 'ollama'
              ? 'http://localhost:11434'
              : PROVIDER_OPTIONS.find((p) => p.value === provider)?.defaultBaseUrl || 'https://api.openai.com/v1'
          }
          value={data.baseUrl || ''}
          onChange={(val) => handleFieldChange('baseUrl', val)}
        />
      </div>

      {/* ── 3. System Instructions & User Prompt ─────────────────────────── */}
      <CodeEditor
        label="System Instructions"
        placeholder="You are an autonomous AI Agent that solves tasks step-by-step using authorized tools."
        value={data.systemPrompt || ''}
        onChange={(val) => handleFieldChange('systemPrompt', val)}
        onInsertVariable={() =>
          onOpenVariablePicker &&
          onOpenVariablePicker((val) => handleFieldChange('systemPrompt', (data.systemPrompt || '') + val))
        }
        minLines={3}
        helperText="Defines the agent persona, role, reasoning behavior, and constraints."
      />

      <CodeEditor
        label="Objective / Task Prompt"
        required
        placeholder="Fetch customer data for order {{steps.trigger.orderId}} and summarize the status..."
        value={data.prompt || ''}
        onChange={(val) => handleFieldChange('prompt', val)}
        onInsertVariable={() =>
          onOpenVariablePicker &&
          onOpenVariablePicker((val) => handleFieldChange('prompt', (data.prompt || '') + val))
        }
        minLines={4}
        helperText="Main goal or question the agent will solve using available tools."
      />

      {/* ── 4. Authorized Tools Allowlist ─────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm, 8px)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 0,
        }}
      >
        {/* Header row with wrap support */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            <Wrench size={13} style={{ color: 'var(--accent-primary)' }} />
            <span>Authorized Tools</span>
            <Badge size="sm" variant="primary">{selectedTools.length}/{AVAILABLE_TOOLS.length}</Badge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={selectAllTools}
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 'var(--radius-xs, 4px)',
                background: 'rgba(108, 99, 255, 0.15)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={selectUtilityTools}
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 'var(--radius-xs, 4px)',
                background: 'rgba(108, 99, 255, 0.15)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(108, 99, 255, 0.3)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Utilities
            </button>
            <button
              type="button"
              onClick={deselectAllTools}
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 'var(--radius-xs, 4px)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              None
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = activeCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategoryFilter(cat.id)}
                style={{
                  fontSize: '0.68rem',
                  padding: '3px 8px',
                  borderRadius: 12,
                  border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  background: isActive ? 'rgba(108, 99, 255, 0.2)' : 'var(--bg-elevated)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Tools Selection List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 220,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {filteredTools.map((tool) => {
            const isChecked = selectedTools.includes(tool.id);
            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '7px 8px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: isChecked ? '1px solid rgba(108, 99, 255, 0.5)' : '1px solid var(--border)',
                  background: isChecked ? 'rgba(108, 99, 255, 0.1)' : 'var(--bg-elevated)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  minWidth: 0,
                }}
              >
                <div style={{ color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: 2, flexShrink: 0 }}>
                  {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {tool.name}
                    </span>
                    {tool.sensitive && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--accent-warning)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontWeight: 500,
                        }}
                      >
                        <AlertTriangle size={9} /> Sensitive
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      lineHeight: 1.35,
                    }}
                  >
                    {tool.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. Sensitive Actions Policy ───────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm, 8px)',
          padding: 10,
        }}
      >
        <SwitchField
          label="Allow Sensitive & Mutation Actions"
          value={Boolean(data.allowSensitiveActions)}
          onChange={(checked) => handleFieldChange('allowSensitiveActions', checked)}
          helperText="When enabled, permits the agent to send Slack/Discord messages, write files, and mutate databases. When disabled, sensitive tool calls are blocked."
        />
      </div>

      {/* ── 6. Optional Structured Response Schema ────────────────────────── */}
      <SidebarSection
        title="Structured Response Schema"
        icon={<Code size={13} />}
        collapsible
        defaultOpen={showSchema}
        onToggle={setShowSchema}
      >
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Constrain final response to adhere to a JSON schema:
        </span>
        <CodeEditor
          placeholder={'{\n  "type": "object",\n  "properties": {\n    "summary": { "type": "string" }\n  }\n}'}
          value={
            typeof data.responseSchema === 'object'
              ? JSON.stringify(data.responseSchema, null, 2)
              : data.responseSchema || ''
          }
          onChange={(val) => handleFieldChange('responseSchema', val)}
          minLines={4}
        />
      </SidebarSection>

      {/* ── 7. Execution Limits & Model Parameters (Advanced) ─────────────── */}
      <SidebarSection
        title="Execution Limits & Parameters"
        icon={<Sliders size={13} />}
        collapsible
        defaultOpen={showAdvanced}
        onToggle={setShowAdvanced}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Responsive grid that wraps on 360px without squeezing */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 10,
              }}
            >
              <NumberField
                label="Max Iterations"
                min={1}
                max={25}
                value={data.maxIterations ?? 10}
                onChange={(val) => handleFieldChange('maxIterations', val || 10)}
                helperText="Loop guard (1-25)"
              />
              <NumberField
                label="Max Tool Calls"
                min={1}
                max={50}
                value={data.maxToolCalls ?? 15}
                onChange={(val) => handleFieldChange('maxToolCalls', val || 15)}
                helperText="Tool call cap (1-50)"
              />
              <NumberField
                label="Timeout (ms)"
                min={1000}
                step={1000}
                value={data.timeout ?? 60000}
                onChange={(val) => handleFieldChange('timeout', val || 60000)}
                helperText="Agent max runtime"
              />
              <NumberField
                label="Max Tokens"
                min={100}
                step={256}
                value={data.maxTokens ?? 2048}
                onChange={(val) => handleFieldChange('maxTokens', val || 2048)}
                helperText="Completion tokens"
              />
            </div>

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
                  {data.temperature ?? 0.2}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={data.temperature ?? 0.2}
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
                <span>Precise reasoning (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
        </div>
      </SidebarSection>
    </div>
  );
}