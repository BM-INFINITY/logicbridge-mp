import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useWorkflowStore from '../../../store/workflowStore';
import useCanvasStore from '../../../store/canvasStore';

export default function AIPanel({ onGenerate }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { generateFromAI } = useWorkflowStore();
  const { setShowAI } = useCanvasStore();

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Enter a description');
    setLoading(true);
    try {
      const res = await generateFromAI(prompt);
      onGenerate(res);
      setShowAI(false);
      toast.success('AI workflow generated! ✨');
    } catch {
      toast.error('AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        right: 16,
        width: 340,
        zIndex: 200,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-hover)',
        borderRadius: 14,
        padding: 18,
        boxShadow: 'var(--shadow-glow)',
      }}
      className="animate-fade-in"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="#22d3ee" />
          <span style={{ fontWeight: 600, color: 'var(--accent-secondary)', fontSize: '0.9rem' }}>AI Generator</span>
        </div>
        <button onClick={() => setShowAI(false)} style={{ background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={15} />
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5 }}>
        Describe your automation in plain English:
      </p>
      <textarea
        id="ai-prompt"
        className="form-input form-textarea"
        style={{ minHeight: 80, marginBottom: 10, fontSize: '0.83rem' }}
        placeholder='"Fetch weather data every hour and log temperature"'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        id="ai-generate-btn"
        className="btn btn-primary w-full"
        style={{ fontSize: '0.85rem', padding: '9px' }}
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? <><span className="spinner" /> Generating...</> : <><Sparkles size={14} /> Generate Workflow</>}
      </button>
    </div>
  );
}
