import React from 'react';
import { Activity, Play, CheckCircle2, XCircle, AlertCircle, GitBranch, ArrowRight } from 'lucide-react';
import useReplayStore from '../../store/replayStore';

const EVENT_ICONS = {
  EXECUTION_STARTED:   <Play size={13} color="#6c63ff" />,
  NODE_STARTED:        <Activity size={13} color="#22d3ee" />,
  CONDITION_EVALUATED: <GitBranch size={13} color="#f59e0b" />,
  BRANCH_SELECTED:     <ArrowRight size={13} color="#22c55e" />,
  NODE_SKIPPED:        <AlertCircle size={13} color="#f59e0b" />,
  NODE_COMPLETED:      <CheckCircle2 size={13} color="#22c55e" />,
  NODE_FAILED:         <XCircle size={13} color="#ef4444" />,
  EXECUTION_SUCCESS:   <CheckCircle2 size={13} color="#22c55e" />,
  EXECUTION_FAILED:    <XCircle size={13} color="#ef4444" />,
};

/**
 * ReplayEventsPanel — dedicated, scrollable execution event feed component.
 * Selecting an event jumps the timeline cursor to the corresponding replay step.
 */
export default function ReplayEventsPanel() {
  const { snapshots, timelineCursor, jumpToEvent, seekTo } = useReplayStore();

  const currentSnapshot = snapshots[timelineCursor.index] || null;
  const events = currentSnapshot?.events || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={15} color="var(--accent-secondary)" />
          Execution Event Feed
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Events List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {events.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
            No events recorded yet.
          </div>
        ) : (
          events.map((evt, i) => {
            const icon = EVENT_ICONS[evt.type] || <Activity size={13} color="var(--text-muted)" />;
            const isClickable = evt.stepIndex !== undefined;

            return (
              <div
                key={evt.id || i}
                onClick={() => {
                  if (evt.id) jumpToEvent(evt.id);
                  else if (evt.stepIndex !== undefined) seekTo(evt.stepIndex);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => isClickable && (e.currentTarget.style.background = 'rgba(108,99,255,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              >
                <div style={{ marginTop: 2 }}>{icon}</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {evt.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                    {evt.details}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
