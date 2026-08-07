import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Square, RotateCcw } from 'lucide-react';
import useReplayStore from '../../store/replayStore';

const SPEEDS = [0.5, 1, 2, 5];
const MODES = [
  { id: 'normal',       label: 'Normal',       hint: 'Auto animation' },
  { id: 'step-by-step', label: 'Step-by-Step', hint: 'Manual step' },
  { id: 'debug',        label: 'Debug',        hint: 'Pause per step' },
];

/**
 * TimelineControls — playback toolbar with controls, mode selector, and speed pills.
 */
export default function TimelineControls() {
  const {
    isPlaying,
    mode,
    speed,
    timelineCursor,
    play,
    pause,
    restart,
    stopReplay,
    stepForward,
    stepBackward,
    setSpeed,
    setMode,
  } = useReplayStore();

  const isStart = timelineCursor.isStart;
  const isEnd = timelineCursor.isEnd;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justify: 'space-between',
      gap: 12,
      padding: '8px 16px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      flexWrap: 'wrap',
    }}>
      {/* 1. Playback Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          id="replay-btn-restart"
          onClick={restart}
          title="Restart Replay (Step 0)"
          className="btn btn-sm btn-ghost"
          style={{ padding: '6px 8px' }}
        >
          <RotateCcw size={14} />
        </button>

        <button
          id="replay-btn-step-prev"
          onClick={stepBackward}
          disabled={isStart}
          title="Previous Step"
          className="btn btn-sm btn-secondary"
          style={{ padding: '6px 10px' }}
        >
          <SkipBack size={14} />
        </button>

        {isPlaying ? (
          <button
            id="replay-btn-pause"
            onClick={pause}
            title="Pause Replay"
            className="btn btn-sm"
            style={{ background: '#f59e0b', color: '#fff', padding: '6px 16px', fontWeight: 600 }}
          >
            <Pause size={14} /> Pause
          </button>
        ) : (
          <button
            id="replay-btn-play"
            onClick={play}
            title={isEnd ? 'Restart & Play' : 'Play Replay'}
            className="btn btn-sm btn-primary"
            style={{ padding: '6px 16px', fontWeight: 600 }}
          >
            <Play size={14} /> {isEnd ? 'Replay' : 'Play'}
          </button>
        )}

        <button
          id="replay-btn-step-next"
          onClick={stepForward}
          disabled={isEnd}
          title="Next Step"
          className="btn btn-sm btn-secondary"
          style={{ padding: '6px 10px' }}
        >
          <SkipForward size={14} />
        </button>

        <button
          id="replay-btn-stop"
          onClick={stopReplay}
          title="Stop & Exit Replay Mode"
          className="btn btn-sm btn-danger"
          style={{ padding: '6px 10px', marginLeft: 4 }}
        >
          <Square size={13} /> Stop
        </button>
      </div>

      {/* 2. Replay Mode Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Mode:
        </span>
        <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: 2, border: '1px solid var(--border)' }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              id={`replay-mode-${m.id}`}
              onClick={() => setMode(m.id)}
              title={m.hint}
              style={{
                background: mode === m.id ? 'var(--accent-primary)' : 'transparent',
                color: mode === m.id ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: mode === m.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Speed Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Speed:
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              id={`replay-speed-${s}x`}
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? 'rgba(34,211,238,0.18)' : 'var(--bg-elevated)',
                border: speed === s ? '1px solid rgba(34,211,238,0.5)' : '1px solid var(--border)',
                color: speed === s ? 'var(--accent-secondary)' : 'var(--text-muted)',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
