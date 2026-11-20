import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, LayoutTemplate, Sparkles, Play, Download, Upload, Save,
  KeyRound, UserCheck, Calendar, Webhook, ChevronDown, Settings2,
  Undo2, Redo2, Maximize2, Map, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useCanvasStore from '../../../store/canvasStore';
import { WorkflowSerializer } from '../../../utils';
import ImportModal from '../../ImportModal';
import NodeValidator from '../../../validators/NodeValidator';
import { Button, IconButton, Badge, StatusIndicator, Tooltip } from '../../ui';

export default function Toolbar({
  workflowName,
  setWorkflowName,
  onBack,
  onSave,
  onRun,
  onOpenVariables,
  onOpenApprovals,
  onOpenSchedules,
  onOpenWebhookEvents,
  onFitView,
  isDirty = false,
}) {
  const {
    nodes, edges, setNodes, setEdges, running, saving,
    showAI, setShowAI, showTemplates, setShowTemplates,
    undo, redo, canUndo, canRedo,
    showMinimap, toggleMinimap,
    showValidationDrawer, setShowValidationDrawer,
  } = useCanvasStore();

  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const toolsMenuRef = useRef(null);

  // Close tools dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setShowToolsMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowToolsMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute Workflow Validation State
  const validation = useMemo(() => {
    return NodeValidator.validateWorkflow(nodes, edges);
  }, [nodes, edges]);

  const handleExport = () => {
    try {
      const packageData = WorkflowSerializer.serialize(
        { name: workflowName, nodes, edges },
        { exportedBy: 'builder' }
      );
      const jsonStr = JSON.stringify(packageData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const filename = WorkflowSerializer.generateExportFilename
        ? WorkflowSerializer.generateExportFilename(workflowName, 1)
        : `${workflowName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v1.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Workflow exported successfully!');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const val = WorkflowSerializer.validate(parsed);
        if (!val.valid) {
          toast.error(`Invalid import package: ${val.error}`);
          return;
        }
        setImportPreview(parsed);
      } catch (err) {
        toast.error(`Import parse error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (mode) => {
    if (!importPreview) return;
    try {
      const deserialized = WorkflowSerializer.deserialize(importPreview);
      setWorkflowName(deserialized.name || workflowName);
      setNodes(deserialized.nodes || []);
      setEdges(deserialized.edges || []);
      setImportPreview(null);
      toast.success(`Successfully imported "${deserialized.name}" (${mode === 'overwrite' ? 'Overwritten' : 'Loaded'})!`);
    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
    }
  };

  const hasWebhookNode = nodes.some((n) => n.type === 'trigger-webhook');

  return (
    <header className="builder-toolbar" role="toolbar" aria-label="Workflow Builder Toolbar">
      {/* ─── Left Section: Navigation, Workflow Title, Saved State ─────────── */}
      <div className="builder-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onBack}
          style={{ padding: '6px 8px', fontSize: '0.8rem', gap: 4 }}
          aria-label="Back to Dashboard"
          title="Back to Dashboard"
        >
          <ArrowLeft size={14} /> <span className="hide-on-mobile">Back</span>
        </button>

        <div style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0 }} />

        {/* Workflow Title input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <input
            id="workflow-title-input"
            className="builder-title-input"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            aria-label="Workflow Name"
          />

          {/* Saved Status Indicator */}
          {isDirty && (
            <span
              className="unsaved-dot"
              title="Unsaved changes pending"
              aria-label="Unsaved changes pending"
            />
          )}
          <span className="hide-on-mobile">
            <StatusIndicator
              variant={isDirty ? 'warning' : 'success'}
              label={isDirty ? 'Unsaved changes' : 'Saved'}
              size="sm"
            />
          </span>
        </div>

        {/* Node Count Pill */}
        {nodes.length > 0 && (
          <span className="hide-on-compact">
            <Badge variant="neutral" size="sm">
              {nodes.length} {nodes.length === 1 ? 'node' : 'nodes'}
            </Badge>
          </span>
        )}
      </div>

      {/* ─── Center Section: History & Canvas Navigation ──────────────────── */}
      <div className="builder-toolbar-center hide-on-tablet" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {/* Undo Button */}
        <Tooltip text="Undo (Ctrl+Z)">
          <IconButton
            icon={<Undo2 size={14} />}
            onClick={() => undo()}
            disabled={!canUndo()}
            size="sm"
            variant="ghost"
            aria-label="Undo canvas change"
          />
        </Tooltip>

        {/* Redo Button */}
        <Tooltip text="Redo (Ctrl+Y)">
          <IconButton
            icon={<Redo2 size={14} />}
            onClick={() => redo()}
            disabled={!canRedo()}
            size="sm"
            variant="ghost"
            aria-label="Redo canvas change"
          />
        </Tooltip>

        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />

        {/* Fit View */}
        <Tooltip text="Fit View to Screen">
          <IconButton
            icon={<Maximize2 size={14} />}
            onClick={onFitView}
            size="sm"
            variant="ghost"
            aria-label="Fit View"
          />
        </Tooltip>

        {/* Toggle Minimap */}
        <Tooltip text={showMinimap ? 'Hide Minimap' : 'Show Minimap'}>
          <IconButton
            icon={<Map size={14} />}
            onClick={toggleMinimap}
            size="sm"
            variant={showMinimap ? 'secondary' : 'ghost'}
            aria-label="Toggle Minimap"
          />
        </Tooltip>

        {/* Validation Alert Pill */}
        {nodes.length > 0 && (
          <button
            onClick={() => setShowValidationDrawer(!showValidationDrawer)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              marginLeft: 6,
              padding: '3px 9px',
              borderRadius: 12,
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: validation.valid ? '1px solid var(--success-border)' : '1px solid var(--warning-border)',
              background: validation.valid ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: validation.valid ? 'var(--success)' : 'var(--warning)',
              transition: 'all 0.15s ease',
            }}
            title={validation.valid ? 'All steps validated' : `${validation.issues.length} step configuration issues detected`}
            aria-label="Toggle Workflow Validation Details"
          >
            {validation.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            <span>{validation.valid ? 'Valid' : `${validation.issues.length} ${validation.issues.length === 1 ? 'issue' : 'issues'}`}</span>
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {/* ─── Right Section: Actions, Tools, Save, Run ──────────────────────── */}
      <div className="builder-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Tools Menu Dropdown */}
        <div style={{ position: 'relative' }} ref={toolsMenuRef}>
          <button
            id="builder-tools-menu-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            style={{ fontSize: '0.78rem', padding: '6px 8px', gap: 4 }}
            aria-expanded={showToolsMenu}
            aria-haspopup="true"
          >
            <Settings2 size={13} color="var(--accent-primary)" />
            <span className="hide-on-compact">Tools</span>
            <ChevronDown size={12} color="var(--text-muted)" />
          </button>

          {showToolsMenu && (
            <div className="dropdown-menu" style={{ width: 210, right: 0, zIndex: 110 }}>
              {/* Responsive Center controls fallback for mobile/tablet */}
              <div className="hide-on-desktop">
                <button
                  className="dropdown-item"
                  onClick={() => { setShowToolsMenu(false); onFitView(); }}
                >
                  <Maximize2 size={14} color="var(--accent-secondary)" />
                  Fit View to Screen
                </button>

                <button
                  className="dropdown-item"
                  onClick={() => { setShowToolsMenu(false); toggleMinimap(); }}
                >
                  <Map size={14} color="var(--accent-primary)" />
                  {showMinimap ? 'Hide Minimap' : 'Show Minimap'}
                </button>

                {nodes.length > 0 && (
                  <button
                    className="dropdown-item"
                    onClick={() => { setShowToolsMenu(false); setShowValidationDrawer(true); }}
                  >
                    {validation.valid ? <CheckCircle2 size={14} color="var(--color-success)" /> : <AlertTriangle size={14} color="var(--color-warning)" />}
                    Validation ({validation.issues.length} issues)
                  </button>
                )}

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setShowTemplates(!showTemplates);
                    setShowAI(false);
                  }}
                >
                  <LayoutTemplate size={14} />
                  Templates
                </button>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowToolsMenu(false);
                    setShowAI(!showAI);
                    setShowTemplates(false);
                  }}
                >
                  <Sparkles size={14} color="#22d3ee" />
                  AI Assist
                </button>

                <div className="dropdown-divider" />
              </div>

              <button
                className="dropdown-item"
                onClick={() => { setShowToolsMenu(false); onOpenVariables(); }}
              >
                <KeyRound size={14} color="var(--accent-primary)" />
                Variables & Secrets
              </button>

              <button
                className="dropdown-item"
                onClick={() => { setShowToolsMenu(false); onOpenApprovals(); }}
              >
                <UserCheck size={14} color="#ec4899" />
                Pending Approvals
              </button>

              <button
                className="dropdown-item"
                onClick={() => { setShowToolsMenu(false); onOpenSchedules(); }}
              >
                <Calendar size={14} color="#38bdf8" />
                Schedules & Cron
              </button>

              {hasWebhookNode && (
                <button
                  className="dropdown-item"
                  onClick={() => { setShowToolsMenu(false); onOpenWebhookEvents(); }}
                >
                  <Webhook size={14} color="#22c55e" />
                  Webhook Deliveries
                </button>
              )}

              <div className="dropdown-divider" />

              <button
                className="dropdown-item"
                onClick={() => { setShowToolsMenu(false); handleExport(); }}
              >
                <Download size={14} />
                Export Workflow JSON
              </button>

              <button
                className="dropdown-item"
                onClick={() => { setShowToolsMenu(false); fileInputRef.current?.click(); }}
              >
                <Upload size={14} />
                Import Workflow JSON
              </button>
            </div>
          )}
        </div>

        {/* Templates Modal Button */}
        <button
          id="builder-templates-btn"
          className="btn btn-secondary btn-sm hide-on-tablet"
          onClick={() => {
            setShowTemplates(!showTemplates);
            setShowAI(false);
          }}
          style={{ fontSize: '0.78rem', padding: '6px 8px', gap: 4 }}
        >
          <LayoutTemplate size={13} />
          <span className="hide-on-laptop">Templates</span>
        </button>

        {/* AI Generate Button */}
        <button
          id="builder-ai-btn"
          className="btn btn-secondary btn-sm hide-on-tablet"
          onClick={() => {
            setShowAI(!showAI);
            setShowTemplates(false);
          }}
          style={{ fontSize: '0.78rem', padding: '6px 8px', gap: 4, color: '#22d3ee' }}
        >
          <Sparkles size={13} color="#22d3ee" />
          <span className="hide-on-laptop">AI Assist</span>
        </button>

        {/* Save Button */}
        <Button
          id="save-workflow-btn"
          variant="secondary"
          size="sm"
          onClick={onSave}
          loading={saving}
          icon={!saving ? <Save size={13} /> : undefined}
          style={{ padding: '6px 10px', fontSize: '0.78rem' }}
        >
          {saving ? '...' : 'Save'}
        </Button>

        {/* Run Button (Primary) */}
        <Button
          id="run-workflow-btn"
          variant="primary"
          size="sm"
          onClick={onRun}
          disabled={running || nodes.length === 0}
          loading={running}
          icon={!running ? <Play size={13} /> : undefined}
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          {running ? '...' : 'Run'}
        </Button>
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <ImportModal
          previewData={importPreview}
          onConfirm={handleConfirmImport}
          onClose={() => setImportPreview(null)}
        />
      )}
    </header>
  );
}
