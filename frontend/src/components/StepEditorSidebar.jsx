import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { NODE_DEFS } from '../data/templates';
import API from '../api/client';
import NodeValidator from '../validators/NodeValidator';
import VariablePicker from './VariablePicker';
import { SidebarHeader, SidebarTabs, SidebarFactory, TestPanel } from './sidebar';

export default function StepEditorSidebar({
  node,
  nodes,
  edges,
  onUpdate,
  onDelete,
  onClose,
  workflowId,
}) {
  const [data, setData] = useState({ ...node?.data });
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'testing' | 'docs'
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [activePickerField, setActivePickerField] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [autoDetectingCsv, setAutoDetectingCsv] = useState(false);

  useEffect(() => {
    setData({ ...node?.data });
    setTestResult(null);
  }, [node?.id]);

  if (!node) return null;
  const def = NODE_DEFS[node.type] || { label: node.type, icon: '⚙️', color: '#6c63ff', category: 'action' };

  const handleDataChange = (updatedData) => {
    setData(updatedData);
    onUpdate(node.id, updatedData);
  };

  const handleInsertVariable = (variableStr) => {
    if (!activePickerField) return;
    const currentVal = data[activePickerField] || '';
    handleDataChange({
      ...data,
      [activePickerField]: currentVal + ' ' + variableStr,
    });
  };

  const handleAutoDetectCsv = async () => {
    setAutoDetectingCsv(true);
    try {
      const currentNodeIndex = nodes.findIndex((n) => n.id === node.id);
      const upstreamNodes = nodes.filter(
        (n, idx) => n.id !== node.id && (currentNodeIndex === -1 || idx < currentNodeIndex)
      );

      let detectedKeys = [];
      let detectedArrayPath = '';

      for (const uNode of upstreamNodes.reverse()) {
        const out = uNode.data?._lastOutput;
        if (!out) continue;

        let targetArr = [];
        if (Array.isArray(out)) targetArr = out;
        else if (out.records && Array.isArray(out.records)) { targetArr = out.records; detectedArrayPath = 'records'; }
        else if (out.data && Array.isArray(out.data)) { targetArr = out.data; detectedArrayPath = 'data'; }
        else if (out.items && Array.isArray(out.items)) { targetArr = out.items; detectedArrayPath = 'items'; }
        else if (out.results && Array.isArray(out.results)) { targetArr = out.results; detectedArrayPath = 'results'; }

        if (targetArr.length > 0 && typeof targetArr[0] === 'object') {
          detectedKeys = Object.keys(targetArr[0]);
          break;
        }
      }

      if (detectedKeys.length > 0) {
        const newCols = detectedKeys.map((k) => ({ header: k, value: `{{ ${k} }}` }));
        handleDataChange({ ...data, columns: newCols, arrayPath: detectedArrayPath || data.arrayPath });
        toast.success(`Auto-detected ${detectedKeys.length} columns!`);
      } else {
        const fallback = [
          { header: 'Enrollment No.', value: '{{ Enrollment No. }}' },
          { header: 'Name of Student', value: '{{ Name of Student }}' },
          { header: 'Branch', value: '{{ Branch }}' },
          { header: 'Team Id', value: '{{ Team Id }}' },
          { header: 'Attendance (%)', value: '{{ Attendance (%) }}' },
        ];
        handleDataChange({ ...data, columns: fallback, arrayPath: 'records' });
        toast.success('Generated default columns for student attendance data!');
      }
    } catch {
      toast.error('Column auto-detection failed');
    } finally {
      setAutoDetectingCsv(false);
    }
  };

  const handleTestStep = async () => {
    const validation = NodeValidator.validateNode({ ...node, data });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      if (workflowId) {
        const { data: res } = await API.post(`/api/workflows/${workflowId}/run`);
        const stepRes = res.steps?.find((s) => s.nodeId === node.id) || res.steps?.[res.steps.length - 1];
        setTestResult(stepRes || res);
      } else {
        await new Promise((r) => setTimeout(r, 600));
        setTestResult({
          status: 'success',
          output: { message: `Simulated output for ${node.type}`, data },
          duration: 120,
        });
      }
      toast.success('Step tested successfully!');
    } catch (err) {
      setTestResult({ status: 'failed', error: err.response?.data?.message || err.message });
      toast.error('Test execution failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 390,
        height: '100%',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 90,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
        animation: 'slideInRight 0.2s ease',
      }}
    >
      <SidebarHeader
        title={data.label || def.label}
        icon={def.icon}
        color={def.color}
        onDelete={() => onDelete(node.id)}
        onClose={onClose}
      />

      <SidebarTabs activeTab={activeTab} onChangeTab={setActiveTab} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 30px' }}>
        {activeTab === 'config' && (
          <SidebarFactory
            nodeType={node.type}
            data={data}
            onChange={handleDataChange}
            onAutoDetectCsv={handleAutoDetectCsv}
            autoDetectingCsv={autoDetectingCsv}
            onOpenVariablePicker={(fieldName) => {
              setActivePickerField(fieldName);
              setShowVariablePicker(true);
            }}
          />
        )}

        {activeTab === 'testing' && (
          <TestPanel onTest={handleTestStep} testing={testing} testResult={testResult} />
        )}

        {activeTab === 'docs' && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Step Documentation</h4>
            <p>
              Node Type: <strong style={{ color: def.color }}>{node.type}</strong>
            </p>
            <p>
              Category: <strong>{def.category}</strong>
            </p>
            <p>
              Configurable fields allow mapping handlebars variables like <code>{'{{prev.field}}'}</code> from upstream steps into URL parameters, request bodies, or CSV exports.
            </p>
          </div>
        )}
      </div>

      {showVariablePicker && (
        <VariablePicker
          nodes={nodes}
          edges={edges}
          currentNodeId={node.id}
          onSelect={handleInsertVariable}
          onClose={() => setShowVariablePicker(false)}
        />
      )}
    </div>
  );
}
