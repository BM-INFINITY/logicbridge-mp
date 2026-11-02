import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Lock,
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  Copy,
  Check,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  FileCode,
  Hash,
  ToggleLeft,
  Type,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useWorkflowStore from '../store/workflowStore';

const BLOCKED_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'tostring',
  'valueof',
  'hasownproperty',
  'isprototypeof',
]);

const VALID_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]{0,63}$/;

export default function VariablesModal({ isOpen, onClose, workflowId }) {
  const {
    variables,
    secrets,
    fetchVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    fetchSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
  } = useWorkflowStore();

  const [activeTab, setActiveTab] = useState('variables'); // 'variables' | 'secrets'
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Variable Form State
  const [varName, setVarName] = useState('');
  const [varType, setVarType] = useState('string');
  const [varValue, setVarValue] = useState('');
  const [varDescription, setVarDescription] = useState('');

  // Secret Form State
  const [secName, setSecName] = useState('');
  const [secValue, setSecValue] = useState('');
  const [secDescription, setSecDescription] = useState('');
  const [showSecValue, setShowSecValue] = useState(false);

  // Errors
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (isOpen && workflowId) {
      fetchVariables(workflowId);
      fetchSecrets(workflowId);
    }
  }, [isOpen, workflowId]);

  if (!isOpen) return null;

  const resetForms = () => {
    setIsAdding(false);
    setEditingItem(null);
    setVarName('');
    setVarType('string');
    setVarValue('');
    setVarDescription('');
    setSecName('');
    setSecValue('');
    setSecDescription('');
    setShowSecValue(false);
    setFormError('');
  };

  const validateName = (name) => {
    if (!name || !name.trim()) return 'Name is required';
    const trimmed = name.trim();
    if (BLOCKED_NAMES.has(trimmed.toLowerCase())) {
      return `"${trimmed}" is a reserved word and cannot be used as an identifier`;
    }
    if (!VALID_IDENTIFIER_REGEX.test(trimmed)) {
      return 'Name must start with a letter/underscore and contain only letters, numbers, hyphens, or underscores (1-64 chars)';
    }
    return '';
  };

  const handleCopyReference = (expr) => {
    navigator.clipboard.writeText(expr);
    setCopiedKey(expr);
    toast.success(`Copied ${expr} to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Variable Handlers ──────────────────────────────────────────────────────
  const handleOpenAddVar = () => {
    resetForms();
    setIsAdding(true);
  };

  const handleOpenEditVar = (v) => {
    resetForms();
    setEditingItem(v);
    setVarName(v.name);
    setVarType(v.type || 'string');
    setVarValue(v.type === 'json' && typeof v.value === 'object' ? JSON.stringify(v.value, null, 2) : String(v.value ?? ''));
    setVarDescription(v.description || '');
  };

  const handleSaveVariable = async (e) => {
    e.preventDefault();
    setFormError('');
    const err = validateName(varName);
    if (err) {
      setFormError(err);
      return;
    }

    let parsedVal = varValue;
    if (varType === 'number') {
      const num = Number(varValue);
      if (isNaN(num)) {
        setFormError('Value must be a valid number');
        return;
      }
      parsedVal = num;
    } else if (varType === 'boolean') {
      parsedVal = varValue === true || varValue === 'true' || varValue === 1;
    } else if (varType === 'json') {
      try {
        parsedVal = typeof varValue === 'string' ? JSON.parse(varValue) : varValue;
      } catch (jsonErr) {
        setFormError(`Invalid JSON syntax: ${jsonErr.message}`);
        return;
      }
    }

    try {
      if (editingItem) {
        await updateVariable(workflowId, editingItem._id, {
          name: varName.trim(),
          type: varType,
          value: parsedVal,
          description: varDescription.trim(),
        });
        toast.success(`Variable "${varName.trim()}" updated`);
      } else {
        await createVariable(workflowId, {
          name: varName.trim(),
          type: varType,
          value: parsedVal,
          description: varDescription.trim(),
        });
        toast.success(`Variable "${varName.trim()}" created`);
      }
      resetForms();
    } catch (apiErr) {
      setFormError(apiErr.response?.data?.message || apiErr.message || 'Operation failed');
    }
  };

  const handleDeleteVariable = async (varId, name) => {
    if (!window.confirm(`Are you sure you want to delete variable "${name}"?`)) return;
    try {
      await deleteVariable(workflowId, varId);
      toast.success(`Variable "${name}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete variable');
    }
  };

  // ── Secret Handlers ────────────────────────────────────────────────────────
  const handleOpenAddSec = () => {
    resetForms();
    setIsAdding(true);
  };

  const handleOpenEditSec = (s) => {
    resetForms();
    setEditingItem(s);
    setSecName(s.name);
    setSecValue('');
    setSecDescription(s.description || '');
  };

  const handleSaveSecret = async (e) => {
    e.preventDefault();
    setFormError('');
    const err = validateName(secName);
    if (err) {
      setFormError(err);
      return;
    }

    if (!editingItem && (!secValue || !secValue.trim())) {
      setFormError('Secret value is required');
      return;
    }

    try {
      if (editingItem) {
        await updateSecret(workflowId, editingItem._id, {
          name: secName.trim(),
          value: secValue ? secValue : undefined,
          description: secDescription.trim(),
        });
        toast.success(`Secret "${secName.trim()}" updated`);
      } else {
        await createSecret(workflowId, {
          name: secName.trim(),
          value: secValue,
          description: secDescription.trim(),
        });
        toast.success(`Secret "${secName.trim()}" created and encrypted`);
      }
      resetForms();
    } catch (apiErr) {
      setFormError(apiErr.response?.data?.message || apiErr.message || 'Operation failed');
    }
  };

  const handleDeleteSecret = async (secretId, name) => {
    if (!window.confirm(`Are you sure you want to delete secret "${name}"?`)) return;
    try {
      await deleteSecret(workflowId, secretId);
      toast.success(`Secret "${name}" deleted`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete secret');
    }
  };

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'number':
        return <Hash size={12} color="#10b981" />;
      case 'boolean':
        return <ToggleLeft size={12} color="#8b5cf6" />;
      case 'json':
        return <FileCode size={12} color="#f59e0b" />;
      default:
        return <Type size={12} color="#3b82f6" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '85vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(108,99,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Workflow Variables & Secrets
              </h2>
              <p style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text-muted)' }}>
                Workflow-scoped configuration and encrypted credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            padding: '0 20px',
            background: 'var(--bg-card)',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveTab('variables'); resetForms(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'variables' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'variables' ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'variables' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Variables ({variables.length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('secrets'); resetForms(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'secrets' ? '2px solid #ec4899' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === 'secrets' ? '#ec4899' : 'var(--text-muted)',
              fontWeight: activeTab === 'secrets' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <Lock size={14} />
            <span>Secrets ({secrets.length})</span>
          </button>
        </div>

        {/* Body Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'variables' && (
            <div>
              {/* Notice & Add Button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Non-sensitive values available to all nodes via{' '}
                  <code style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {'{{variables.NAME}}'}
                  </code>
                </div>
                {!isAdding && !editingItem && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleOpenAddVar}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}
                  >
                    <Plus size={14} /> Add Variable
                  </button>
                )}
              </div>

              {/* Form */}
              {(isAdding || editingItem) && (
                <form
                  onSubmit={handleSaveVariable}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, color: 'var(--accent-primary)' }}>
                    {editingItem ? `Edit Variable: ${editingItem.name}` : 'New Workflow Variable'}
                  </div>

                  {formError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: 6,
                        color: '#f87171',
                        fontSize: '0.75rem',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <AlertCircle size={14} /> {formError}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Variable Name *
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. apiBaseUrl, maxRetries"
                        value={varName}
                        onChange={(e) => setVarName(e.target.value)}
                        required
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                        Type
                      </label>
                      <select
                        className="form-input"
                        value={varType}
                        onChange={(e) => {
                          setVarType(e.target.value);
                          if (e.target.value === 'boolean' && varValue !== true && varValue !== false) {
                            setVarValue(true);
                          }
                        }}
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                        <option value="json">JSON</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Value *
                    </label>
                    {varType === 'boolean' ? (
                      <select
                        className="form-input"
                        value={String(varValue)}
                        onChange={(e) => setVarValue(e.target.value === 'true')}
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      >
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    ) : varType === 'json' ? (
                      <textarea
                        className="form-input"
                        rows={4}
                        placeholder='{\n  "env": "production"\n}'
                        value={varValue}
                        onChange={(e) => setVarValue(e.target.value)}
                        style={{ fontSize: '0.8rem', fontFamily: 'monospace', padding: '8px 10px' }}
                      />
                    ) : (
                      <input
                        type={varType === 'number' ? 'number' : 'text'}
                        step={varType === 'number' ? 'any' : undefined}
                        className="form-input"
                        placeholder={varType === 'number' ? '42' : 'Value string'}
                        value={varValue}
                        onChange={(e) => setVarValue(e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      />
                    )}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Short note about purpose"
                      value={varDescription}
                      onChange={(e) => setVarDescription(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={resetForms}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      {editingItem ? 'Update Variable' : 'Create Variable'}
                    </button>
                  </div>
                </form>
              )}

              {/* Variables List */}
              {variables.length === 0 && !isAdding && !editingItem ? (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    borderRadius: 10,
                    border: '1px dashed var(--border)',
                  }}
                >
                  <SlidersHorizontal size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                    No workflow variables yet
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Define reusable constants, environment targets, and threshold limits.
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleOpenAddVar}>
                    <Plus size={14} /> Add Your First Variable
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {variables.map((v) => {
                    const refCode = `{{variables.${v.name}}}`;
                    const valPreview = typeof v.value === 'object' ? JSON.stringify(v.value) : String(v.value ?? '');
                    return (
                      <div
                        key={v._id || v.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {renderTypeIcon(v.type)}
                            {v.type}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              {v.name}
                            </div>
                            {v.description && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {v.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            flex: 1,
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-elevated)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 240,
                          }}
                          title={valPreview}
                        >
                          {valPreview}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title={`Copy ${refCode}`}
                            onClick={() => handleCopyReference(refCode)}
                            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {copiedKey === refCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            <span style={{ fontSize: '0.7rem' }}>Ref</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Edit"
                            onClick={() => handleOpenEditVar(v)}
                            style={{ padding: '4px 6px' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Delete"
                            onClick={() => handleDeleteVariable(v._id, v.name)}
                            style={{ padding: '4px 6px', color: '#f87171' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'secrets' && (
            <div>
              {/* Security Shield Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'rgba(236,72,153,0.06)',
                  border: '1px solid rgba(236,72,153,0.3)',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <ShieldCheck size={18} color="#ec4899" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong style={{ color: '#ec4899' }}>Encrypted at Rest (AES-256-GCM).</strong> Secret values are
                  never sent to the frontend or exposed in logs, outputs, replay, or exports. Reference securely in nodes with{' '}
                  <code style={{ color: '#ec4899', fontWeight: 600 }}>{'{{secrets.SECRET_NAME}}'}</code>.
                </div>
              </div>

              {/* Action bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Manage sensitive API keys, tokens, and credentials.
                </div>
                {!isAdding && !editingItem && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleOpenAddSec}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.78rem',
                      background: '#ec4899',
                      borderColor: '#ec4899',
                    }}
                  >
                    <Plus size={14} /> Add Secret
                  </button>
                )}
              </div>

              {/* Secret Form */}
              {(isAdding || editingItem) && (
                <form
                  onSubmit={handleSaveSecret}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid #ec4899',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 12, color: '#ec4899' }}>
                    {editingItem ? `Update Secret: ${editingItem.name}` : 'New Encrypted Secret'}
                  </div>

                  {formError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid #ef4444',
                        borderRadius: 6,
                        color: '#f87171',
                        fontSize: '0.75rem',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <AlertCircle size={14} /> {formError}
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Secret Name *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. STRIPE_KEY, GITHUB_TOKEN"
                      value={secName}
                      onChange={(e) => setSecName(e.target.value)}
                      required
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {editingItem ? 'New Secret Value (Leave blank to keep existing encrypted value)' : 'Secret Value *'}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showSecValue ? 'text' : 'password'}
                        className="form-input"
                        placeholder={editingItem ? '•••••••••••• (Unchanged)' : 'Enter sensitive secret value'}
                        value={secValue}
                        onChange={(e) => setSecValue(e.target.value)}
                        required={!editingItem}
                        style={{ fontSize: '0.8rem', padding: '6px 36px 6px 10px', width: '100%' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecValue(!showSecValue)}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                        }}
                      >
                        {showSecValue ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="What this secret is used for"
                      value={secDescription}
                      onChange={(e) => setSecDescription(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={resetForms}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      style={{ background: '#ec4899', borderColor: '#ec4899' }}
                    >
                      {editingItem ? 'Save Secret' : 'Encrypt & Save Secret'}
                    </button>
                  </div>
                </form>
              )}

              {/* Secrets List */}
              {secrets.length === 0 && !isAdding && !editingItem ? (
                <div
                  style={{
                    padding: '36px 20px',
                    textAlign: 'center',
                    background: 'var(--bg-card)',
                    borderRadius: 10,
                    border: '1px dashed var(--border)',
                  }}
                >
                  <Lock size={28} color="var(--text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                    No workflow secrets configured
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Store authentication tokens, webhook secrets, and private credentials securely.
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleOpenAddSec}
                    style={{ background: '#ec4899', borderColor: '#ec4899' }}
                  >
                    <Plus size={14} /> Add Encrypted Secret
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {secrets.map((s) => {
                    const refCode = `{{secrets.${s.name}}}`;
                    return (
                      <div
                        key={s._id || s.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: 'rgba(236,72,153,0.1)',
                              border: '1px solid rgba(236,72,153,0.3)',
                              color: '#ec4899',
                            }}
                          >
                            <Lock size={11} />
                            Encrypted
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                              {s.name}
                            </div>
                            {s.description && (
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {s.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            flex: 1,
                            fontSize: '0.78rem',
                            fontFamily: 'monospace',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-elevated)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            letterSpacing: '0.15em',
                            maxWidth: 240,
                          }}
                        >
                          ••••••••••••
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title={`Copy ${refCode}`}
                            onClick={() => handleCopyReference(refCode)}
                            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            {copiedKey === refCode ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                            <span style={{ fontSize: '0.7rem' }}>Ref</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Update Secret Value"
                            onClick={() => handleOpenEditSec(s)}
                            style={{ padding: '4px 6px' }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title="Delete"
                            onClick={() => handleDeleteSecret(s._id, s.name)}
                            style={{ padding: '4px 6px', color: '#f87171' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

