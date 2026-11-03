import React, { useState, useEffect, useCallback } from 'react';
import {
  Webhook,
  RefreshCw,
  X,
  RotateCcw,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';

export default function WebhookEventsModal({ isOpen, onClose, workflowId, workflowName }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [replayingId, setReplayingId] = useState(null);

  const fetchEvents = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const url = statusFilter
        ? `/api/webhooks/workflow/${workflowId}?status=${statusFilter}`
        : `/api/webhooks/workflow/${workflowId}`;
      const res = await API.get(url);
      setEvents(res.data?.data?.events || res.data?.events || []);
    } catch (err) {
      toast.error(`Failed to load events: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  }, [workflowId, statusFilter]);

  useEffect(() => {
    if (isOpen && workflowId) {
      fetchEvents();
    }
  }, [isOpen, workflowId, fetchEvents]);

  const handleReplay = async (event) => {
    setReplayingId(event._id);
    try {
      const res = await API.post(`/api/webhooks/events/${event._id}/replay`);
      toast.success(`Event replayed! Execution: ${res.data?.data?.executionId || 'created'}`);
      await fetchEvents();
    } catch (err) {
      toast.error(`Replay failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setReplayingId(null);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text));
    toast.success(`Copied ${label} to clipboard!`);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card, #1e1e24)',
          border: '1px solid var(--border, #2d2d3a)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          color: 'var(--text-primary, #f3f4f6)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #2d2d3a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e',
              }}
            >
              <Webhook size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Webhook Delivery Log</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)' }}>
                {workflowName || 'Workflow'} • Inbound requests, security outcomes & event inspection
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={fetchEvents}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #9ca3af)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border, #2d2d3a)',
            background: 'var(--bg-elevated, #16161a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Status:</span>
            {['', 'success', 'failed', 'rejected', 'duplicate', 'ignored'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '3px 10px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: statusFilter === st ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                  color: statusFilter === st ? '#22c55e' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {st || 'All'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Total Events: <strong>{events.length}</strong>
          </span>
        </div>

        {/* Body (Split list + Inspector) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Events List */}
          <div
            style={{
              width: selectedEvent ? '50%' : '100%',
              borderRight: selectedEvent ? '1px solid var(--border, #2d2d3a)' : 'none',
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                Loading webhook events...
              </div>
            ) : events.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  border: '1px dashed var(--border, #2d2d3a)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                }}
              >
                <Webhook size={32} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No webhook events recorded matching this filter.</p>
              </div>
            ) : (
              events.map((ev) => {
                const isSelected = selectedEvent?._id === ev._id;
                const statusColor =
                  ev.status === 'success'
                    ? '#22c55e'
                    : ev.status === 'duplicate'
                    ? '#38bdf8'
                    : ev.status === 'ignored'
                    ? '#9ca3af'
                    : '#ef4444';

                return (
                  <div
                    key={ev._id}
                    onClick={() => setSelectedEvent(ev)}
                    style={{
                      background: isSelected ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-elevated, #16161a)',
                      border: isSelected ? '1px solid #22c55e' : '1px solid var(--border, #2d2d3a)',
                      borderRadius: 8,
                      padding: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                            background: 'rgba(255,255,255,0.08)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {ev.method}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: `${statusColor}22`,
                            color: statusColor,
                          }}
                        >
                          {ev.status} ({ev.httpStatus})
                        </span>
                        {ev.isReplay && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: '#a855f7',
                            }}
                          >
                            Replay
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(ev.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <span>ID: {ev.eventIdentifier || ev.correlationId?.substring(0, 16) || '—'}</span>
                      <span>{ev.duration ? `${ev.duration}ms` : ''}</span>
                    </div>

                    {ev.failureReason && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: '#ef4444',
                          background: 'rgba(239, 68, 68, 0.1)',
                          padding: '3px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {ev.failureReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Event Inspector */}
          {selectedEvent && (
            <div
              style={{
                width: '50%',
                overflowY: 'auto',
                padding: 16,
                background: 'var(--bg-elevated, #16161a)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>Event Inspector</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleReplay(selectedEvent)}
                    disabled={replayingId === selectedEvent._id}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RotateCcw size={12} className={replayingId === selectedEvent._id ? 'spin' : ''} />
                    {replayingId === selectedEvent._id ? 'Replaying...' : 'Replay Event'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedEvent(null)}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Event Metadata */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: 10,
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div><strong>Correlation ID:</strong> {selectedEvent.correlationId || '—'}</div>
                <div><strong>Idempotency Key:</strong> {selectedEvent.eventIdentifier || '—'}</div>
                <div><strong>Received:</strong> {new Date(selectedEvent.receivedAt).toLocaleString()}</div>
                <div><strong>Client IP:</strong> {selectedEvent.ip}</div>
                <div><strong>Execution ID:</strong> {selectedEvent.execution?._id || selectedEvent.execution || 'None'}</div>
              </div>

              {/* Headers */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Request Headers (Redacted)</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyToClipboard(selectedEvent.headers, 'headers')}
                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <pre
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.72rem',
                    maxHeight: 120,
                    overflowY: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedEvent.headers || {}, null, 2)}
                </pre>
              </div>

              {/* Body */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Payload Body</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyToClipboard(selectedEvent.body, 'payload body')}
                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <pre
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.72rem',
                    maxHeight: 200,
                    overflowY: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(selectedEvent.body || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
