import React, { useState } from 'react';
import { X, Play, CheckCircle2, XCircle, Activity, BarChart2, Database, ChevronUp, ChevronDown } from 'lucide-react';
import useReplayStore from '../../store/replayStore';
import TimelineNode from './TimelineNode';
import TimelineControls from './TimelineControls';
import ReplayInspector from './ReplayInspector';
import ReplayEventsPanel from './ReplayEventsPanel';
import ExecutionStatistics from './ExecutionStatistics';

/**
 * ExecutionTimeline — main bottom overlay panel orchestrating timeline bar, controls, and side drawer.
 */
export default function ExecutionTimeline() {
  const {
    isReplayActive,
    selectedExecution,
    snapshots,
    timelineCursor,
    activeTab,
    seekTo,
    stopReplay,
    setInspectorNodeId,
    setActiveTab,
  } = useReplayStore();

  const [expanded, setExpanded] = useState(true);

  if (!isReplayActive || !selectedExecution) return null;

  const currentSnapshot = snapshots[timelineCursor.index] || null;
  const isSuccess = selectedExecution.status === 'success';

  return (
    <div style={{
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      zIndex: 90,
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'none', // outer area non-blocking
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(8px)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: expanded ? '70vh' : 'auto',
        transition: 'max-height 0.3s ease',
      }}>
        {/* ── Top Header Strip ────────────────────────────────────────────────── */}
        <div style={{
          padding: '10px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: isSuccess ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isSuccess ? '#22c55e' : '#ef4444',
              fontSize: '0.75rem', fontWeight: 700,
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
              border: `1px solid ${isSuccess ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              {isSuccess ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              Replay: {selectedExecution.workflow?.name || 'Workflow'}
            </span>

            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Frame {timelineCursor.index + 1} of {timelineCursor.totalSnapshots}
            </span>
          </div>

          {/* Subpanel tabs toggle & controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 2, border: '1px solid var(--border)' }}>
              {[
                { id: 'inspector', label: 'Inspector', icon: <Database size={12} /> },
                { id: 'events',    label: 'Events',    icon: <Activity size={12} /> },
                { id: 'stats',     label: 'Statistics',icon: <BarChart2 size={12} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  id={`replay-tab-${tab.id}`}
                  onClick={() => { setActiveTab(tab.id); if (!expanded) setExpanded(true); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                    border: 'none', borderRadius: 4, padding: '3px 10px',
                    fontSize: '0.72rem', fontWeight: activeTab === tab.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse Panel' : 'Expand Panel'}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>

            <button
              id="replay-close-btn"
              onClick={stopReplay}
              title="Close Replay"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Main Panel Split (Controls + Timeline Bar on Left, Drawer on Right) ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: expanded ? 260 : 0 }}>
          {/* Left Area: Controls + Scrollable Timeline */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 12, overflowY: 'auto' }}>
            <TimelineControls />

            {/* Timeline Progress Chips Bar */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Execution Step Sequence
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                  Active: {currentSnapshot?.nodeName || 'Start'}
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4,
              }}>
                {snapshots.map((snap, idx) => (
                  <React.Fragment key={snap.snapshotId}>
                    <TimelineNode
                      snapshot={snap}
                      index={idx}
                      isSelected={timelineCursor.index === idx}
                      isActive={currentSnapshot?.nodeId === snap.nodeId}
                      onClick={() => {
                        seekTo(idx);
                        setInspectorNodeId(snap.nodeId);
                      }}
                    />
                    {idx < snapshots.length - 1 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Right Area: Active Tab Drawer (Inspector / Events / Stats) */}
          {expanded && (
            <div style={{ width: 340, height: '100%', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
              {activeTab === 'inspector' && <ReplayInspector />}
              {activeTab === 'events' && <ReplayEventsPanel />}
              {activeTab === 'stats' && <ExecutionStatistics />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
