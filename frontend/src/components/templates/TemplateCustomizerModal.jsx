import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SidebarFactory from '../sidebar/SidebarFactory';
import VariablePicker from '../VariablePicker';
import ConfirmDialog from '../ConfirmDialog';
import NodeValidator from '../../validators/NodeValidator';
import { NODE_DEFS } from '../../data/templates';
import { getNodeIcon } from '../../constants/Icons';
import API from '../../api/client';
import {
  X, Check, AlertCircle, AlertTriangle, Sliders, Eye, SlidersHorizontal,
  ArrowLeft, ArrowRight, Sparkles, Plus, Trash2, ShieldCheck, Database,
  CheckCircle2,
} from 'lucide-react';

const DIFFICULTY_STYLE = {
  Beginner:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)' },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  Advanced:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)' },
};

/**
 * TemplateCustomizerModal
 *
 * Interactive pre-import configuration and customization experience for workflow templates.
 * Allows users to inspect all nodes, customize parameters using native SidebarFactory forms,
 * validate settings in real time via NodeValidator, preview the resulting topology and
 * branch routes, and import a clean, isolated workflow instance into the Builder.
 */
export default function TemplateCustomizerModal({
  template,
  onClose,
  onConfirmInstall,
  workflowId,
}) {
  // ── 1. Isolated Deep Clone of Template Data ──────────────────────────────
  // Guarantees canonical template in templates.js is NEVER mutated
  const [draftNodes, setDraftNodes] = useState(() => {
    return JSON.parse(JSON.stringify(template?.nodes || []));
  });
  const [draftEdges, setDraftEdges] = useState(() => {
    return JSON.parse(JSON.stringify(template?.edges || []));
  });

  const [workflowName, setWorkflowName] = useState(template?.name || 'Customized Workflow');
  const [description, setDescription] = useState(template?.description || '');

  // Workflow-level variables draft
  const [draftVariables, setDraftVariables] = useState(() => {
    const list = [];
    const rawReq = template?.requiredVariables || [];
    const rawInit = template?.initialVariables || [];

    const seen = new Set();
    rawReq.forEach((v) => {
      seen.add(v.name);
      list.push({
        name: v.name,
        type: v.type || 'string',
        value: v.default !== undefined ? String(v.default) : '',
        description: v.description || '',
        required: true,
      });
    });

    rawInit.forEach((v) => {
      if (!seen.has(v.name)) {
        seen.add(v.name);
        list.push({
          name: v.name,
          type: v.type || 'string',
          value: v.value !== undefined ? String(v.value) : '',
          description: v.description || '',
          required: false,
        });
      }
    });

    return list;
  });

  // UI state
  const [activeTab, setActiveTab] = useState('configure'); // 'configure' | 'preview' | 'variables'
  const [selectedNodeId, setSelectedNodeId] = useState(() => template?.nodes?.[0]?.id || null);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showIncompleteConfirm, setShowIncompleteConfirm] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [activePickerField, setActivePickerField] = useState(null);
  const [autoDetectingCsv, setAutoDetectingCsv] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [availableConnections, setAvailableConnections] = useState([]);

  // Fetch connections for availability status display
  useEffect(() => {
    let isMounted = true;
    API.get('/api/connections')
      .then((res) => {
        if (isMounted) {
          const list = Array.isArray(res.data) ? res.data : (res.data?.connections || []);
          setAvailableConnections(list);
        }
      })
      .catch(() => {
        // Safe offline fallback
      });
    return () => { isMounted = false; };
  }, []);

  // Keyboard handler for Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !showVariablePicker && !showDiscardConfirm && !showIncompleteConfirm && !isSubmitting) {
        if (isDirty) {
          setShowDiscardConfirm(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isDirty, showVariablePicker, showDiscardConfirm, showIncompleteConfirm, isSubmitting]);

  // Selected node pointer
  const selectedNodeIndex = useMemo(() => {
    return draftNodes.findIndex((n) => n.id === selectedNodeId);
  }, [draftNodes, selectedNodeId]);

  const selectedNode = useMemo(() => {
    return draftNodes[selectedNodeIndex] || draftNodes[0] || null;
  }, [draftNodes, selectedNodeIndex]);

  // Node definition metadata
  const selectedNodeDef = useMemo(() => {
    if (!selectedNode) return { label: 'Step', color: '#6c63ff', category: 'action', desc: '' };
    return NODE_DEFS[selectedNode.type] || {
      label: selectedNode.type,
      color: '#6c63ff',
      category: 'action',
      desc: '',
    };
  }, [selectedNode]);

  // ── 2. Real-Time Node & Workflow Validation ──────────────────────────────
  const selectedNodeValidation = useMemo(() => {
    if (!selectedNode) return { valid: true };
    return NodeValidator.validateNode(selectedNode);
  }, [selectedNode]);

  const workflowValidation = useMemo(() => {
    return NodeValidator.validateWorkflow(draftNodes, draftEdges);
  }, [draftNodes, draftEdges]);

  // Structural Graph Integrity Check (Distinguished from incomplete settings)
  const structuralValidation = useMemo(() => {
    const errors = [];
    if (!Array.isArray(draftNodes) || draftNodes.length === 0) {
      errors.push('Workflow must contain at least one step.');
    }
    const nodeIds = new Set(draftNodes.map((n) => n.id));
    (draftEdges || []).forEach((edge, idx) => {
      const edgeLabel = edge.id || `Connection #${idx + 1}`;
      if (!edge.source || !nodeIds.has(edge.source)) {
        errors.push(`${edgeLabel} references missing source node "${edge.source}".`);
      }
      if (!edge.target || !nodeIds.has(edge.target)) {
        errors.push(`${edgeLabel} references missing target node "${edge.target}".`);
      }
      if (edge.source && edge.target && edge.source === edge.target) {
        errors.push(`Invalid self-loop detected on step "${edge.source}".`);
      }
    });
    return {
      valid: errors.length === 0,
      errors,
    };
  }, [draftNodes, draftEdges]);

  // Node status helper for navigator
  const getNodeValidationStatus = useCallback((node) => {
    const res = NodeValidator.validateNode(node);
    if (res.valid) {
      return { valid: true, label: 'Configured', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
    }
    return { valid: false, label: 'Needs Config', error: res.error, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  }, []);

  // ── 3. Draft Mutation Handlers ───────────────────────────────────────────
  const handleUpdateNode = useCallback((nodeId, updatedData) => {
    setIsDirty(true);
    setDraftNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n))
    );
  }, []);

  const handleOpenVariablePicker = useCallback((fieldOrCallback) => {
    setActivePickerField(() => fieldOrCallback);
    setShowVariablePicker(true);
  }, []);

  const handleInsertVariable = useCallback((variableStr) => {
    if (typeof activePickerField === 'function') {
      activePickerField(variableStr);
      setIsDirty(true);
    } else if (activePickerField && selectedNode) {
      const currentVal = selectedNode.data?.[activePickerField] || '';
      handleUpdateNode(selectedNode.id, {
        ...selectedNode.data,
        [activePickerField]: currentVal ? `${currentVal} ${variableStr}` : variableStr,
      });
    }
    setShowVariablePicker(false);
  }, [activePickerField, selectedNode, handleUpdateNode]);

  const handleAutoDetectCsv = useCallback(async () => {
    if (!selectedNode) return;
    setAutoDetectingCsv(true);
    try {
      const currentNodeIndex = draftNodes.findIndex((n) => n.id === selectedNode.id);
      const upstreamNodes = draftNodes.filter(
        (n, idx) => n.id !== selectedNode.id && (currentNodeIndex === -1 || idx < currentNodeIndex)
      );

      let detectedKeys = [];
      for (const uNode of [...upstreamNodes].reverse()) {
        const out = uNode.data?._lastOutput;
        if (!out) continue;
        let targetArr = [];
        if (Array.isArray(out)) targetArr = out;
        else if (out.records && Array.isArray(out.records)) targetArr = out.records;
        else if (out.data && Array.isArray(out.data)) targetArr = out.data;
        else if (out.items && Array.isArray(out.items)) targetArr = out.items;
        else if (out.results && Array.isArray(out.results)) targetArr = out.results;

        if (targetArr.length > 0 && typeof targetArr[0] === 'object') {
          detectedKeys = Object.keys(targetArr[0]);
          break;
        }
      }

      if (detectedKeys.length > 0) {
        const newCols = detectedKeys.map((k) => ({ header: k, value: `{{ ${k} }}` }));
        handleUpdateNode(selectedNode.id, {
          columns: newCols,
          arrayPath: selectedNode.data?.arrayPath || 'records',
        });
      } else {
        const fallback = [
          { header: 'id', value: '{{ id }}' },
          { header: 'name', value: '{{ name }}' },
          { header: 'status', value: '{{ status }}' },
          { header: 'timestamp', value: '{{ timestamp }}' },
        ];
        handleUpdateNode(selectedNode.id, {
          columns: fallback,
          arrayPath: selectedNode.data?.arrayPath || 'records',
        });
      }
    } catch {
      // Fallback completed
    } finally {
      setAutoDetectingCsv(false);
    }
  }, [selectedNode, draftNodes, handleUpdateNode]);

  // Variables tab actions
  const handleVariableChange = (idx, field, val) => {
    setIsDirty(true);
    setDraftVariables((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleAddVariable = () => {
    setIsDirty(true);
    const newIdx = draftVariables.length + 1;
    setDraftVariables((prev) => [
      ...prev,
      { name: `VAR_${newIdx}`, type: 'string', value: '', description: '', required: false },
    ]);
  };

  const handleRemoveVariable = (idx) => {
    setIsDirty(true);
    setDraftVariables((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── 4. Final Import Handler ──────────────────────────────────────────────
  const executeImport = async () => {
    if (!workflowName.trim()) {
      setErrorMessage('Workflow name is required.');
      return;
    }

    if (!structuralValidation.valid) {
      setErrorMessage(`Cannot import: ${structuralValidation.errors[0]}`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Process variables typed map
      const processedVariables = {};
      draftVariables.forEach((v) => {
        if (!v.name) return;
        const raw = v.value;
        if (v.type === 'number') {
          processedVariables[v.name] = Number(raw) || 0;
        } else if (v.type === 'boolean') {
          processedVariables[v.name] = raw === 'true' || raw === true;
        } else if (v.type === 'json') {
          try {
            processedVariables[v.name] = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch {
            processedVariables[v.name] = raw;
          }
        } else {
          processedVariables[v.name] = raw ?? '';
        }
      });

      // Construct customized template payload
      const customizedTemplate = {
        ...template,
        name: workflowName.trim(),
        description: description.trim(),
        nodes: draftNodes,
        edges: draftEdges,
      };

      const installOptions = {
        name: workflowName.trim(),
        description: description.trim(),
        variables: processedVariables,
        nodes: draftNodes,
        edges: draftEdges,
      };

      await onConfirmInstall(customizedTemplate, installOptions);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to install customized workflow template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerImport = () => {
    // If structural error exists, block immediately
    if (!structuralValidation.valid) {
      setErrorMessage(`Invalid workflow structure: ${structuralValidation.errors.join(', ')}`);
      return;
    }

    // If incomplete configuration exists, prompt with confirmation advisory
    if (!workflowValidation.valid) {
      setShowIncompleteConfirm(true);
      return;
    }

    // Otherwise clean import
    executeImport();
  };

  // Required connections from template metadata
  const requiredConnections = useMemo(() => {
    return template?.requiredConnections || (template?.requiresConnection ? [template.requiresConnection] : []);
  }, [template]);

  const diffStyle = DIFFICULTY_STYLE[template?.difficulty] || DIFFICULTY_STYLE.Beginner;

  return (
    <div
      id="template-customizer-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 260,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', overflowY: 'auto',
      }}
      onClick={() => {
        if (isDirty) setShowDiscardConfirm(true);
        else onClose();
      }}
    >
      <div
        id="template-customizer-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(1160px, 96vw)',
          maxWidth: 1160,
          height: 'min(860px, 92vh)',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: '0 24px 70px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* ── Modal Header ──────────────────────────────────────────────── */}
        <header style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(108,99,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}>
              <Sliders size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Pre-Import Customizer
                </span>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 600,
                  padding: '2px 8px', borderRadius: 12,
                  background: diffStyle.bg, color: diffStyle.color, border: `1px solid ${diffStyle.border}`,
                }}>
                  {template?.difficulty || 'Beginner'}
                </span>
                {template?.category && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600,
                    padding: '2px 8px', borderRadius: 12,
                    background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                  }}>
                    {template.category}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                {template?.name || 'Workflow Template'}
              </h2>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--bg-card)', padding: '3px 4px', borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('configure')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none',
                fontSize: '0.8rem', fontWeight: activeTab === 'configure' ? 600 : 500,
                background: activeTab === 'configure' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'configure' ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Sliders size={14} />
              Configure Steps ({draftNodes.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none',
                fontSize: '0.8rem', fontWeight: activeTab === 'preview' ? 600 : 500,
                background: activeTab === 'preview' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'preview' ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <Eye size={14} />
              Workflow Preview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('variables')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8, border: 'none',
                fontSize: '0.8rem', fontWeight: activeTab === 'variables' ? 600 : 500,
                background: activeTab === 'variables' ? 'var(--bg-elevated)' : 'transparent',
                color: activeTab === 'variables' ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <SlidersHorizontal size={14} />
              Workflow Info & Variables ({draftVariables.length})
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              if (isDirty) setShowDiscardConfirm(true);
              else onClose();
            }}
            disabled={isSubmitting}
            aria-label="Close Customizer"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 6, cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </header>

        {/* ── Error Banner (if any) ─────────────────────────────────────── */}
        {errorMessage && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)',
            padding: '10px 24px', color: '#ef4444', fontSize: '0.82rem',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Main Tab Content ──────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* TAB 1: CONFIGURE STEPS */}
          {activeTab === 'configure' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Left Step Navigator */}
              <nav
                aria-label="Workflow Steps Navigator"
                style={{
                  width: 290, minWidth: 260, maxWidth: 320,
                  background: 'var(--bg-card)',
                  borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>Step Sequence</span>
                  <span style={{
                    fontSize: '0.7rem', padding: '2px 7px', borderRadius: 10,
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                  }}>
                    {draftNodes.length} nodes
                  </span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
                  {draftNodes.map((node, idx) => {
                    const isSelected = node.id === selectedNode?.id;
                    const def = NODE_DEFS[node.type] || { label: node.type, color: '#6c63ff' };
                    const IconComponent = getNodeIcon(node.type);
                    const status = getNodeValidationStatus(node);

                    return (
                      <div
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedNodeId(node.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedNodeId(node.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', marginBottom: 6,
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          outline: 'none',
                        }}
                      >
                        {/* Step number badge */}
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700,
                          width: 20, height: 20, borderRadius: '50%',
                          background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </span>

                        {/* Node Icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 8,
                          background: `${def.color}1a`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: def.color, flexShrink: 0,
                        }}>
                          <IconComponent size={15} />
                        </div>

                        {/* Title & Type */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.82rem', fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {node.data?.label || def.label}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {def.label}
                          </div>
                        </div>

                        {/* Status pill */}
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600,
                          padding: '2px 6px', borderRadius: 10,
                          background: status.bg, color: status.color,
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Left Navigator Footer: Workflow Validation Summary */}
                <div style={{
                  padding: '12px 14px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  fontSize: '0.74rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Validation Status:</span>
                  {workflowValidation.valid ? (
                    <span style={{ color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} /> Ready
                    </span>
                  ) : (
                    <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={13} /> {workflowValidation.issues.length} incomplete
                    </span>
                  )}
                </div>
              </nav>

              {/* Right Step Editor Pane */}
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
                background: 'var(--bg-base)',
              }}>
                {selectedNode ? (
                  <>
                    {/* Node Config Header */}
                    <div style={{
                      padding: '14px 24px',
                      borderBottom: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `${selectedNodeDef.color}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: selectedNodeDef.color,
                        }}>
                          {React.createElement(getNodeIcon(selectedNode.type), { size: 18 })}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0 }}>
                              Step {selectedNodeIndex + 1}: {selectedNode.data?.label || selectedNodeDef.label}
                            </h3>
                            <span style={{
                              fontSize: '0.68rem', padding: '1px 8px', borderRadius: 10,
                              background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                              border: '1px solid var(--border)',
                            }}>
                              {selectedNode.type}
                            </span>
                          </div>
                          {selectedNodeDef.desc && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {selectedNodeDef.desc}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Current Step Validation Status */}
                      <div>
                        {selectedNodeValidation.valid ? (
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 600,
                            padding: '3px 10px', borderRadius: 12,
                            background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                            border: '1px solid rgba(34,197,94,0.3)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <Check size={12} /> Configured
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 600,
                            padding: '3px 10px', borderRadius: 12,
                            background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <AlertTriangle size={12} /> Needs Configuration
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Step Validation Warning (if required field missing) */}
                    {!selectedNodeValidation.valid && (
                      <div style={{
                        padding: '10px 24px',
                        background: 'rgba(245,158,11,0.08)',
                        borderBottom: '1px solid rgba(245,158,11,0.2)',
                        color: '#f59e0b', fontSize: '0.78rem',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                        <span>{selectedNodeValidation.error}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: '0.72rem' }}>
                          (You can configure this now or on the canvas after import)
                        </span>
                      </div>
                    )}

                    {/* Form Container (Embedding generic SidebarFactory) */}
                    <div style={{
                      flex: 1, overflowY: 'auto', padding: '20px 24px 32px',
                    }}>
                      <div style={{ maxWidth: 760 }}>
                        <SidebarFactory
                          nodeType={selectedNode.type}
                          data={selectedNode.data || {}}
                          onChange={(updatedData) => handleUpdateNode(selectedNode.id, updatedData)}
                          onOpenVariablePicker={handleOpenVariablePicker}
                          onAutoDetectCsv={handleAutoDetectCsv}
                          autoDetectingCsv={autoDetectingCsv}
                          workflowId={workflowId || null}
                        />
                      </div>
                    </div>

                    {/* Editor Stepping Controls */}
                    <div style={{
                      padding: '12px 24px',
                      borderTop: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      flexShrink: 0,
                    }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={selectedNodeIndex <= 0}
                        onClick={() => setSelectedNodeId(draftNodes[selectedNodeIndex - 1]?.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ArrowLeft size={14} /> Previous Step
                      </button>

                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                        Step {selectedNodeIndex + 1} of {draftNodes.length}
                      </span>

                      {selectedNodeIndex < draftNodes.length - 1 ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedNodeId(draftNodes[selectedNodeIndex + 1]?.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          Next Step <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setActiveTab('preview')}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          Review & Preview <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', fontSize: '0.88rem',
                  }}>
                    Select a step from the sequence on the left to inspect or edit.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: WORKFLOW PREVIEW */}
          {activeTab === 'preview' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Structural vs Configuration Status Banner */}
                {!structuralValidation.valid ? (
                  <div style={{
                    padding: '14px 18px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong>Invalid Workflow Graph Structure</strong>
                      <div style={{ marginTop: 4 }}>
                        {structuralValidation.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                      <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Structural errors must be resolved before importing to avoid canvas corruption.
                      </div>
                    </div>
                  </div>
                ) : !workflowValidation.valid ? (
                  <div style={{
                    padding: '14px 18px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                    color: '#f59e0b', fontSize: '0.82rem', display: 'flex', alignItems: 'flex-start', gap: 10,
                  }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <strong>Configuration Advisory ({workflowValidation.issues.length} Step(s) Need Attention)</strong>
                      <p style={{ margin: '4px 0 8px', fontSize: '0.78rem' }}>
                        Some nodes have optional or required parameters not yet completed. You can complete them now in the <strong>Configure Steps</strong> tab or proceed to import and edit directly on the Builder canvas.
                      </p>
                      <div style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {workflowValidation.issues.map((issue) => (
                          <div key={issue.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{issue.nodeLabel}:</span>
                            <span>{issue.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '14px 18px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <strong>All Steps Valid & Fully Configured</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        Workflow graph structure and node parameters are fully validated. Ready to load into the builder.
                      </p>
                    </div>
                  </div>
                )}

                {/* Integration Credentials Reassurance & Checklist */}
                {requiredConnections.length > 0 && (
                  <div style={{
                    padding: '16px 20px', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <ShieldCheck size={16} color="var(--accent-primary)" />
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>
                        Integration & Connection Requirements
                      </h4>
                    </div>
                    <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Credential secrets are never copied into template definitions or stored in draft state. Saved connection profiles are referenced safely by ID.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {requiredConnections.map((req) => {
                        const hasMatchingConn = availableConnections.some((c) => c.provider === req || c.type === req);
                        return (
                          <div
                            key={req}
                            style={{
                              padding: '6px 12px', borderRadius: 8,
                              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                              fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            <Database size={13} color="var(--accent-primary)" />
                            <span style={{ fontWeight: 600 }}>{req}</span>
                            {hasMatchingConn ? (
                              <span style={{ color: '#22c55e', fontSize: '0.68rem', fontWeight: 600 }}>
                                (Connected)
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                                (Select on canvas)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pipeline Flow Visualization Card Sequence */}
                <div style={{
                  padding: '16px 20px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                  <h4 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 700 }}>
                    Step Pipeline Topology ({draftNodes.length} Steps, {draftEdges.length} Connections)
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {draftNodes.map((node, idx) => {
                      const def = NODE_DEFS[node.type] || { label: node.type, color: '#6c63ff' };
                      const IconComponent = getNodeIcon(node.type);
                      const outgoingEdges = draftEdges.filter((e) => e.source === node.id);
                      const status = getNodeValidationStatus(node);

                      // Extract summary of current configuration
                      let configSummary = '';
                      if (node.type === 'action-http') {
                        configSummary = `${(node.data?.method || 'GET').toUpperCase()} ${node.data?.url || '(No URL set)'}`;
                      } else if (node.type === 'action-condition' || node.type === 'logic-condition') {
                        configSummary = `${node.data?.left || 'field'} ${node.data?.operator || 'equals'} ${node.data?.right || 'value'}`;
                      } else if (node.type === 'action-switch' || node.type === 'logic-switch') {
                        const cases = node.data?.cases || [];
                        configSummary = `${cases.length} branch case(s) on ${node.data?.input || 'input'}`;
                      } else if (node.type === 'action-transform') {
                        const ops = node.data?.operations || [];
                        configSummary = `${ops.length} data transformation operation(s)`;
                      } else if (node.type === 'action-email') {
                        configSummary = `To: ${node.data?.to || '(Recipient not set)'}`;
                      } else if (node.type?.includes('ai')) {
                        configSummary = `Model: ${node.data?.model || 'gpt-4o'}`;
                      } else {
                        configSummary = node.data?.description || node.data?.message || 'Default configuration';
                      }

                      return (
                        <div
                          key={node.id}
                          style={{
                            padding: '12px 14px', borderRadius: 10,
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            display: 'flex', flexDirection: 'column', gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: 'var(--bg-surface)', color: 'var(--text-muted)',
                                fontSize: '0.72rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {idx + 1}
                              </span>
                              <div style={{
                                width: 26, height: 26, borderRadius: 6,
                                background: `${def.color}20`, color: def.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <IconComponent size={14} />
                              </div>
                              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {node.data?.label || def.label}
                              </span>
                              <span style={{
                                fontSize: '0.68rem', padding: '1px 6px', borderRadius: 8,
                                background: 'var(--bg-surface)', color: 'var(--text-muted)',
                              }}>
                                {node.type}
                              </span>
                            </div>

                            <span style={{
                              fontSize: '0.66rem', fontWeight: 600,
                              padding: '2px 8px', borderRadius: 10,
                              background: status.bg, color: status.color,
                            }}>
                              {status.label}
                            </span>
                          </div>

                          {/* Config Summary */}
                          <div style={{
                            fontSize: '0.75rem', color: 'var(--text-secondary)',
                            background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 6,
                            fontFamily: 'monospace',
                          }}>
                            {configSummary}
                          </div>

                          {/* Branch Connections */}
                          {outgoingEdges.length > 0 && (
                            <div style={{
                              display: 'flex', flexWrap: 'wrap', gap: 6,
                              fontSize: '0.72rem', color: 'var(--text-muted)',
                            }}>
                              <span style={{ fontWeight: 600 }}>Routes to:</span>
                              {outgoingEdges.map((edge) => {
                                const targetNode = draftNodes.find((n) => n.id === edge.target);
                                const handleLabel = edge.sourceHandle ? `[${edge.sourceHandle}]` : '→';
                                return (
                                  <span
                                    key={edge.id}
                                    style={{
                                      padding: '2px 8px', borderRadius: 6,
                                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}
                                  >
                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                                      {handleLabel}
                                    </span>
                                    <span>{targetNode?.data?.label || targetNode?.type || edge.target}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORKFLOW INFO & VARIABLES */}
          {activeTab === 'variables' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Workflow Identity */}
                <div style={{
                  padding: '20px 24px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                    Workflow Information
                  </h4>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>
                      Workflow Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={workflowName}
                      onChange={(e) => {
                        setIsDirty(true);
                        setWorkflowName(e.target.value);
                      }}
                      placeholder="Enter workflow name"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: 6 }}>
                      Description
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={description}
                      onChange={(e) => {
                        setIsDirty(true);
                        setDescription(e.target.value);
                      }}
                      placeholder="Optional workflow description..."
                      style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Workflow Variables Manager */}
                <div style={{
                  padding: '20px 24px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                        Workflow Variables ({draftVariables.length})
                      </h4>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Variables can be referenced in steps using <code>{'{{variables.NAME}}'}</code>.
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddVariable}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Plus size={13} /> Add Variable
                    </button>
                  </div>

                  {draftVariables.length === 0 ? (
                    <div style={{
                      padding: '20px', textAlign: 'center',
                      background: 'var(--bg-surface)', borderRadius: 8,
                      color: 'var(--text-muted)', fontSize: '0.8rem',
                    }}>
                      No workflow variables defined. Click "Add Variable" to create one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {draftVariables.map((v, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 14px', borderRadius: 8,
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}
                        >
                          {/* Name */}
                          <div style={{ width: 180 }}>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                              Name {v.required && <span style={{ color: '#ef4444' }}>*</span>}
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              value={v.name}
                              onChange={(e) => handleVariableChange(idx, 'name', e.target.value)}
                              placeholder="VARIABLE_NAME"
                              style={{ width: '100%', fontSize: '0.78rem', fontFamily: 'monospace' }}
                            />
                          </div>

                          {/* Type */}
                          <div style={{ width: 110 }}>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                              Type
                            </label>
                            <select
                              className="form-input"
                              value={v.type}
                              onChange={(e) => handleVariableChange(idx, 'type', e.target.value)}
                              style={{ width: '100%', fontSize: '0.78rem' }}
                            >
                              <option value="string">String</option>
                              <option value="number">Number</option>
                              <option value="boolean">Boolean</option>
                              <option value="json">JSON</option>
                            </select>
                          </div>

                          {/* Value */}
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                              Initial Value
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              value={v.value}
                              onChange={(e) => handleVariableChange(idx, 'value', e.target.value)}
                              placeholder="Value..."
                              style={{ width: '100%', fontSize: '0.78rem' }}
                            />
                          </div>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(idx)}
                            aria-label={`Remove variable ${v.name}`}
                            style={{
                              background: 'transparent', border: 'none',
                              color: 'var(--text-muted)', cursor: 'pointer',
                              padding: '6px', borderRadius: 6,
                              marginTop: 14,
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <footer style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          {/* Status pill on left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!structuralValidation.valid ? (
              <span style={{
                fontSize: '0.74rem', color: '#ef4444', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertCircle size={14} /> Invalid Graph Structure (Cannot Import)
              </span>
            ) : !workflowValidation.valid ? (
              <span style={{
                fontSize: '0.74rem', color: '#f59e0b', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertTriangle size={14} /> {workflowValidation.issues.length} Step(s) Need Config (Import Allowed)
              </span>
            ) : (
              <span style={{
                fontSize: '0.74rem', color: '#22c55e', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle2 size={14} /> Ready to Import
              </span>
            )}
          </div>

          {/* Action buttons on right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (isDirty) setShowDiscardConfirm(true);
                else onClose();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !structuralValidation.valid || !workflowName.trim()}
              onClick={handleTriggerImport}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Sparkles size={14} />
              {isSubmitting ? 'Importing...' : 'Import to Builder'}
            </button>
          </div>
        </footer>

        {/* ── VariablePicker Modal (when invoked from a field) ──────────── */}
        {showVariablePicker && (
          <VariablePicker
            nodes={draftNodes}
            edges={draftEdges}
            currentNodeId={selectedNode?.id}
            customVariables={draftVariables}
            onSelect={handleInsertVariable}
            onClose={() => setShowVariablePicker(false)}
          />
        )}

        {/* ── Discard Confirmation Dialog ───────────────────────────────── */}
        <ConfirmDialog
          isOpen={showDiscardConfirm}
          title="Discard Unsaved Customizations?"
          message="You have unsaved changes to this template. Discarding will revert all step configurations and variables."
          confirmLabel="Discard Changes"
          cancelLabel="Keep Editing"
          variant="danger"
          onConfirm={() => {
            setShowDiscardConfirm(false);
            onClose();
          }}
          onClose={() => setShowDiscardConfirm(false)}
        />

        {/* ── Incomplete Configuration Advisory Confirmation ────────────── */}
        <ConfirmDialog
          isOpen={showIncompleteConfirm}
          title="Import With Incomplete Configurations?"
          message={`This template has ${workflowValidation.issues.length} step(s) with incomplete configuration. You can import now and configure them directly on the canvas, or keep editing here.`}
          confirmLabel="Import to Canvas"
          cancelLabel="Keep Editing"
          variant="warning"
          onConfirm={() => {
            setShowIncompleteConfirm(false);
            executeImport();
          }}
          onClose={() => setShowIncompleteConfirm(false)}
        />
      </div>
    </div>
  );
}
