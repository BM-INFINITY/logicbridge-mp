import React from 'react';
import { Clock, CheckCircle2, AlertCircle, XCircle, Zap, GitBranch } from 'lucide-react';
import useReplayStore from '../../store/replayStore';
import ReplayService from '../../services/ReplayService';

/**
 * ExecutionStatistics — summary stats card for execution replay.
 */
export default function ExecutionStatistics() {
  const { selectedExecution, snapshots } = useReplayStore();

  const stats = ReplayService.calculateStatistics(selectedExecution, snapshots);

  const formatDur = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      padding: '16px',
      gap: 16,
      overflowY: 'auto',
    }}>
      <div style={{ fontWeight: 700, fontSize: '0.92rem', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        Execution Statistics
      </div>

      {/* Grid of metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} /> Total Duration
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {formatDur(stats.totalDuration)}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={11} /> Trigger Source
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-secondary)', marginTop: 2, textTransform: 'capitalize' }}>
            {stats.triggerType}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={11} color="#22c55e" /> Success Rate
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e', marginTop: 2 }}>
            {stats.successRate}%
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={11} /> Executed Nodes
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {stats.executedCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={11} color="#f59e0b" /> Skipped Nodes
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b', marginTop: 2 }}>
            {stats.skippedCount}
          </div>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
            <XCircle size={11} color="#ef4444" /> Failed Nodes
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444', marginTop: 2 }}>
            {stats.failedCount}
          </div>
        </div>
      </div>

      {/* Selected Branches */}
      {stats.selectedBranches.length > 0 && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <GitBranch size={12} color="var(--accent-primary)" /> Condition Branch Selections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.selectedBranches.map((b) => (
              <div key={b.nodeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Condition ({b.nodeId})</span>
                <span style={{
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  color: b.selectedBranch === 'true' ? '#22c55e' : '#ef4444',
                  background: b.selectedBranch === 'true' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                }}>
                  {b.selectedBranch}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
