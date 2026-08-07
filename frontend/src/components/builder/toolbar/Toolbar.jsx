import React, { useRef, useState } from 'react';
import { ArrowLeft, LayoutTemplate, Sparkles, Play, Download, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import useCanvasStore from '../../../store/canvasStore';
import { WorkflowSerializer } from '../../../utils';
import ImportModal from '../../ImportModal';

export default function Toolbar({
  workflowName,
  setWorkflowName,
  onBack,
  onSave,
  onRun,
}) {
  const { nodes, edges, setNodes, setEdges, running, saving, showAI, setShowAI, showTemplates, setShowTemplates } = useCanvasStore();
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);

  const handleExport = () => {
    try {
      const packageData = WorkflowSerializer.serialize(
        { name: workflowName, nodes, edges },
        { exportedBy: 'builder' }
      );
      const jsonStr = JSON.stringify(packageData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const filename = WorkflowSerializer.generateExportFilename ?
        WorkflowSerializer.generateExportFilename(workflowName, 1) :
        `${workflowName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v1.json`;

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
        const validation = WorkflowSerializer.validate(parsed);
        if (!validation.valid) {
          toast.error(`Invalid import package: ${validation.error}`);
          return;
        }

        // Open preview modal
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

  return (
    <div className="builder-toolbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ width: 1, height: 22, background: 'var(--border)' }} />
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            width: 200,
          }}
        />
        {nodes.length > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 6, padding: '2px 8px' }}>
            {nodes.length} nodes
          </span>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={handleExport} title="Export Workflow JSON">
          <Download size={14} /> Export
        </button>

        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} title="Import Workflow JSON">
          <Upload size={14} /> Import
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setShowTemplates(!showTemplates);
            setShowAI(false);
          }}
        >
          <LayoutTemplate size={14} /> Templates
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setShowAI(!showAI);
            setShowTemplates(false);
          }}
        >
          <Sparkles size={14} color="#22d3ee" /> AI Generate
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? <span className="spinner" /> : '💾'} Save
        </button>
        <button
          id="run-workflow-btn"
          className="btn btn-primary btn-sm"
          onClick={onRun}
          disabled={running || nodes.length === 0}
        >
          {running ? <><span className="spinner" /> Running...</> : <><Play size={14} /> Run</>}
        </button>
      </div>

      {importPreview && (
        <ImportModal
          previewData={importPreview}
          onConfirm={handleConfirmImport}
          onClose={() => setImportPreview(null)}
        />
      )}
    </div>
  );
}
