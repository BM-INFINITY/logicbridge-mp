import React, { useState, useEffect } from 'react';
import {
  X, Check, AlertCircle, ShieldAlert, Sparkles,
} from 'lucide-react';

export default function TemplateInstallModal({
  template,
  onClose,
  onConfirmInstall,
}) {
  const [workflowName, setWorkflowName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [variableValues, setVariableValues] = useState(() => {
    const initial = {};
    (template?.requiredVariables || []).forEach((v) => {
      initial[v.name] = v.default !== undefined ? String(v.default) : '';
    });
    return initial;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting]);

  if (!template) return null;

  const requiredConnections = template.requiredConnections || (template.requiresConnection ? [template.requiresConnection] : []);
  const requiredVariables = template.requiredVariables || [];

  const handleVariableChange = (name, val) => {
    setVariableValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!workflowName.trim()) {
      setErrorMessage('Workflow name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Cast variable values to expected types
      const processedVariables = {};
      requiredVariables.forEach((v) => {
        const raw = variableValues[v.name];
        if (v.type === 'number') {
          processedVariables[v.name] = Number(raw) || 0;
        } else if (v.type === 'boolean') {
          processedVariables[v.name] = raw === 'true' || raw === true;
        } else if (v.type === 'json') {
          try {
            processedVariables[v.name] = JSON.parse(raw);
          } catch {
            processedVariables[v.name] = raw;
          }
        } else {
          processedVariables[v.name] = raw ?? '';
        }
      });

      // Prepare payload options
      const installOptions = {
        name: workflowName.trim(),
        description: description.trim(),
        variables: processedVariables,
      };

      await onConfirmInstall(template, installOptions);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to install workflow template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="template-install-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <div
        id="template-install-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(580px, 95vw)', maxWidth: 580,
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Configure & Install
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {template.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, cursor: isSubmitting ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {errorMessage && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              {errorMessage}
            </div>
          )}

          {/* Workflow Name */}
          <div>
            <label htmlFor="install-workflow-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
              Workflow Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="install-workflow-name"
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.88rem' }}
              placeholder="e.g. Production API Sync"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="install-workflow-desc" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              id="install-workflow-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
              placeholder="Brief description of this workflow's purpose..."
            />
          </div>

          {/* Variables Configuration */}
          {requiredVariables.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: 14,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Template Initial Variables
              </div>
              {requiredVariables.map((v) => (
                <div key={v.name}>
                  <label htmlFor={`var-input-${v.name}`} style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: 4 }}>
                    <code>{v.name}</code> {v.label && `(${v.label})`} {v.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input
                    id={`var-input-${v.name}`}
                    type={v.type === 'number' ? 'number' : 'text'}
                    value={variableValues[v.name] ?? ''}
                    onChange={(e) => handleVariableChange(v.name, e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    placeholder={v.default !== undefined ? String(v.default) : ''}
                    required={v.required}
                  />
                  {v.description && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                      {v.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Connection Advisory */}
          {requiredConnections.length > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
              fontSize: '0.78rem', color: 'var(--text-secondary)',
            }}>
              <ShieldAlert size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ color: '#f59e0b' }}>Connection Credentials Required:</strong> This template uses{' '}
                {requiredConnections.map((c) => c.replace('_', ' ')).join(', ')}. After installation, configure your credentials in the Connections manager.
              </div>
            </div>
          )}

          {/* Notice info */}
          <div style={{
            fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Sparkles size={12} style={{ color: 'var(--accent-primary)' }} />
            New unique node and connection IDs will be automatically generated.
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              id="confirm-install-workflow-btn"
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {isSubmitting ? (
                <>Installing...</>
              ) : (
                <>
                  <Check size={14} /> Install Workflow
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
