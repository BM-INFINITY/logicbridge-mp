import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  X,
  History,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import API from '../api/client';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
];

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function ScheduleModal({ isOpen, onClose, workflowId, workflowName }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'form' | 'history'
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Scheduled Trigger',
    type: 'recurring',
    recurrence: 'daily',
    time: '09:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    dayOfMonth: 1,
    cronExpression: '0 9 * * 1-5',
    executionDate: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    startDate: '',
    endDate: '',
    preventOverlap: true,
    catchUpPolicy: 'skip',
    enabled: true,
  });

  // Previews
  const [previewRuns, setPreviewRuns] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedScheduleForHistory, setSelectedScheduleForHistory] = useState(null);

  const fetchSchedules = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/schedules/workflow/${workflowId}`);
      setSchedules(res.data?.data || res.data || []);
    } catch (err) {
      toast.error(`Failed to load schedules: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (isOpen && workflowId) {
      fetchSchedules();
    }
  }, [isOpen, workflowId, fetchSchedules]);

  // Fetch previews when form parameters change
  const fetchPreview = useCallback(async (config) => {
    setPreviewLoading(true);
    try {
      const res = await API.post('/api/schedules/preview?count=5', config);
      setPreviewRuns(res.data?.data?.previews || []);
    } catch {
      setPreviewRuns([]);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'form') {
      const timer = setTimeout(() => {
        fetchPreview(formData);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [formData, activeTab, fetchPreview]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: `${workflowName || 'Workflow'} Schedule`,
      type: 'recurring',
      recurrence: 'daily',
      time: '09:00',
      daysOfWeek: [1, 2, 3, 4, 5],
      dayOfMonth: 1,
      cronExpression: '0 9 * * 1-5',
      executionDate: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      startDate: '',
      endDate: '',
      preventOverlap: true,
      catchUpPolicy: 'skip',
      enabled: true,
    });
    setPreviewRuns([]);
  };

  const handleOpenCreate = () => {
    resetForm();
    setActiveTab('form');
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule._id);
    setFormData({
      name: schedule.name || '',
      type: schedule.type || 'recurring',
      recurrence: schedule.recurrence || 'daily',
      time: schedule.time || '09:00',
      daysOfWeek: schedule.daysOfWeek || [1],
      dayOfMonth: schedule.dayOfMonth || 1,
      cronExpression: schedule.cronExpression || '',
      executionDate: schedule.executionDate ? new Date(schedule.executionDate).toISOString().slice(0, 16) : '',
      timezone: schedule.timezone || 'UTC',
      startDate: schedule.startDate ? new Date(schedule.startDate).toISOString().slice(0, 10) : '',
      endDate: schedule.endDate ? new Date(schedule.endDate).toISOString().slice(0, 10) : '',
      preventOverlap: schedule.preventOverlap !== false,
      catchUpPolicy: schedule.catchUpPolicy || 'skip',
      enabled: schedule.enabled !== false,
    });
    setActiveTab('form');
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        workflowId,
      };

      if (editingId) {
        await API.put(`/api/schedules/${editingId}`, payload);
        toast.success('Schedule updated successfully!');
      } else {
        await API.post('/api/schedules', payload);
        toast.success('Schedule created successfully!');
      }

      await fetchSchedules();
      setActiveTab('list');
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save schedule');
    }
  };

  const handleToggle = async (scheduleId) => {
    try {
      await API.post(`/api/schedules/${scheduleId}/toggle`);
      toast.success('Schedule status toggled');
      await fetchSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Toggle failed');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await API.delete(`/api/schedules/${scheduleId}`);
      toast.success('Schedule deleted');
      await fetchSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Delete failed');
    }
  };

  const handleViewHistory = async (schedule) => {
    setSelectedScheduleForHistory(schedule);
    setHistoryLoading(true);
    setActiveTab('history');
    try {
      const res = await API.get(`/api/schedules/${schedule._id}/history`);
      setHistoryList(res.data?.data || res.data || []);
    } catch (err) {
      toast.error(`Failed to load execution history: ${err.response?.data?.message || err.message}`);
    } finally {
      setHistoryLoading(false);
    }
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
          maxWidth: 780,
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
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Workflow Schedules</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #9ca3af)' }}>
                {workflowName || 'Workflow'} • Durable multi-worker execution timers
              </p>
            </div>
          </div>
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

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border, #2d2d3a)',
            padding: '0 20px',
            background: 'var(--bg-elevated, #16161a)',
          }}
        >
          <button
            onClick={() => setActiveTab('list')}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'list' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'list' ? '#38bdf8' : 'var(--text-muted, #9ca3af)',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Active Schedules ({schedules.length})
          </button>
          <button
            onClick={handleOpenCreate}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'form' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'form' ? '#38bdf8' : 'var(--text-muted, #9ca3af)',
              fontWeight: 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {editingId ? 'Edit Schedule' : '+ New Schedule'}
          </button>
          {selectedScheduleForHistory && (
            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'history' ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === 'history' ? '#38bdf8' : 'var(--text-muted, #9ca3af)',
                fontWeight: 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Execution History
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* TAB 1: LIST */}
          {activeTab === 'list' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #9ca3af)' }}>
                  Configured execution schedules for this workflow
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={fetchSchedules}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={12} className={loading ? 'spin' : ''} /> Refresh
                </button>
              </div>

              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                  Loading schedules...
                </div>
              ) : schedules.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    border: '1px dashed var(--border, #2d2d3a)',
                    borderRadius: 8,
                    color: 'var(--text-muted, #9ca3af)',
                  }}
                >
                  <Calendar size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>No schedules configured for this workflow yet.</p>
                  <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
                    <Plus size={14} /> Add First Schedule
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {schedules.map((s) => {
                    const isCompleted = s.status === 'completed';
                    const isPaused = !s.enabled || s.status === 'paused';
                    return (
                      <div
                        key={s._id}
                        style={{
                          background: 'var(--bg-elevated, #16161a)',
                          border: '1px solid var(--border, #2d2d3a)',
                          borderRadius: 8,
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600 }}>{s.name}</h4>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  background: isCompleted
                                    ? 'rgba(156, 163, 175, 0.2)'
                                    : isPaused
                                    ? 'rgba(234, 179, 8, 0.2)'
                                    : 'rgba(34, 197, 94, 0.2)',
                                  color: isCompleted ? '#9ca3af' : isPaused ? '#eab308' : '#22c55e',
                                }}
                              >
                                {s.status || (s.enabled ? 'active' : 'paused')}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(56, 189, 248, 0.1)',
                                  color: '#38bdf8',
                                }}
                              >
                                {s.type === 'once' ? 'One-Time' : `${s.recurrence} (${s.timezone})`}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {s.type === 'once'
                                ? `At ${new Date(s.executionDate).toLocaleString()}`
                                : s.recurrence === 'cron'
                                ? `Cron: ${s.cronExpression}`
                                : s.recurrence === 'weekly'
                                ? `Every ${s.daysOfWeek?.map((d) => DAYS_OF_WEEK[d]?.label).join(', ')} at ${s.time}`
                                : s.recurrence === 'monthly'
                                ? `Every month on day ${s.dayOfMonth} at ${s.time}`
                                : `Every day at ${s.time}`}
                            </p>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!isCompleted && (
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleToggle(s._id)}
                                title={s.enabled ? 'Pause schedule' : 'Resume schedule'}
                              >
                                {s.enabled ? <Pause size={14} color="#eab308" /> : <Play size={14} color="#22c55e" />}
                              </button>
                            )}
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleViewHistory(s)}
                              title="View execution history"
                            >
                              <History size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleEdit(s)}
                              title="Edit schedule configuration"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleDelete(s._id)}
                              title="Delete schedule"
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </div>

                        {/* Schedule metrics footer */}
                        <div
                          style={{
                            display: 'flex',
                            gap: 16,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Next Run: </span>
                            <span style={{ color: s.nextRunAt ? '#38bdf8' : 'inherit', fontWeight: 500 }}>
                              {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : 'None'}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Last Run: </span>
                            <span>{s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : 'Never'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Total Runs: </span>
                            <span style={{ fontWeight: 600 }}>{s.runCount || 0}</span>
                          </div>
                          {s.preventOverlap && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10b981' }}>
                              <ShieldAlert size={12} /> Overlap Guard
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORM (CREATE / EDIT) */}
          {activeTab === 'form' && (
            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Schedule Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                  Schedule Name
                </label>
                <input
                  type="text"
                  className="input input-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Daily Data Sync"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              {/* Type Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                    Execution Type
                  </label>
                  <select
                    className="select select-sm"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="recurring">Recurring Schedule</option>
                    <option value="once">One-Time Execution</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                    Timezone
                  </label>
                  <select
                    className="select select-sm"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {COMMON_TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional: Once vs Recurring */}
              {formData.type === 'once' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                    Target Execution Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-sm"
                    value={formData.executionDate}
                    onChange={(e) => setFormData({ ...formData, executionDate: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                        Recurrence Frequency
                      </label>
                      <select
                        className="select select-sm"
                        value={formData.recurrence}
                        onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="cron">Cron Expression</option>
                      </select>
                    </div>

                    {formData.recurrence !== 'cron' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                          Time of Day (24-hour)
                        </label>
                        <input
                          type="time"
                          className="input input-sm"
                          value={formData.time}
                          onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                          required
                          style={{ width: '100%' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Weekly Days Picker */}
                  {formData.recurrence === 'weekly' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 6 }}>
                        Active Days of Week
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {DAYS_OF_WEEK.map((d) => {
                          const isSelected = formData.daysOfWeek.includes(d.value);
                          return (
                            <button
                              type="button"
                              key={d.value}
                              onClick={() => {
                                const next = isSelected
                                  ? formData.daysOfWeek.filter((val) => val !== d.value)
                                  : [...formData.daysOfWeek, d.value];
                                setFormData({ ...formData, daysOfWeek: next });
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-elevated)',
                                color: isSelected ? '#38bdf8' : 'var(--text-muted)',
                                fontWeight: 500,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                              }}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Monthly Day Picker */}
                  {formData.recurrence === 'monthly' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                        Day of Month (1 - 31)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        className="input input-sm"
                        value={formData.dayOfMonth}
                        onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: 120 }}
                      />
                    </div>
                  )}

                  {/* Cron Expression */}
                  {formData.recurrence === 'cron' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                        Cron Expression (Minute Hour Day-of-Month Month Day-of-Week)
                      </label>
                      <input
                        type="text"
                        className="input input-sm"
                        value={formData.cronExpression}
                        onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                        placeholder="0 9 * * 1-5"
                        required
                        style={{ width: '100%', fontFamily: 'monospace' }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Examples: <code>*/15 * * * *</code> (every 15 min), <code>0 9 * * 1-5</code> (weekdays 9am), <code>0 0 1 * *</code> (1st of month)
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Start & End Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                    Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input input-sm"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    className="input input-sm"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Concurrency & Overlap Policies */}
              <div
                style={{
                  background: 'var(--bg-elevated, #16161a)',
                  border: '1px solid var(--border, #2d2d3a)',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Prevent Overlapping Execution</span>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      If a previous run is still active, skip or delay the scheduled run rather than running concurrently.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.preventOverlap}
                    onChange={(e) => setFormData({ ...formData, preventOverlap: e.target.checked })}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>Downtime Catch-up Policy</span>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      What to do if server downtime caused scheduled runs to be missed.
                    </p>
                  </div>
                  <select
                    className="select select-sm"
                    value={formData.catchUpPolicy}
                    onChange={(e) => setFormData({ ...formData, catchUpPolicy: e.target.value })}
                    style={{ width: 140 }}
                  >
                    <option value="skip">Skip Missed</option>
                    <option value="run_latest">Run Latest Missed</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Section */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Clock size={14} color="#38bdf8" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
                    Upcoming Scheduled Executions Preview (Next 5)
                  </span>
                </div>
                {previewLoading ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calculating upcoming runs...</span>
                ) : previewRuns.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: '#eab308' }}>
                    No valid upcoming executions found for these parameters.
                  </span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {previewRuns.map((p, idx) => (
                      <li key={idx} style={{ marginBottom: 2 }}>
                        <strong>Run #{idx + 1}:</strong> {new Date(p).toLocaleString()} ({formData.timezone})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setActiveTab('list');
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: EXECUTION HISTORY */}
          {activeTab === 'history' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Execution history triggered by schedule: <strong>{selectedScheduleForHistory?.name}</strong>
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleViewHistory(selectedScheduleForHistory)}
                  disabled={historyLoading}
                >
                  <RefreshCw size={12} className={historyLoading ? 'spin' : ''} /> Refresh
                </button>
              </div>

              {historyLoading ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                  Loading history...
                </div>
              ) : historyList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No scheduled executions recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historyList.map((h) => {
                    const isSuccess = h.status === 'success';
                    return (
                      <div
                        key={h._id}
                        style={{
                          background: 'var(--bg-elevated, #16161a)',
                          border: '1px solid var(--border, #2d2d3a)',
                          borderRadius: 6,
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                background: isSuccess ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isSuccess ? '#22c55e' : '#ef4444',
                              }}
                            >
                              {h.status}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                              {new Date(h.startedAt).toLocaleString()}
                            </span>
                          </div>
                          {h.error && (
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: '#ef4444' }}>
                              Error: {h.error}
                            </p>
                          )}
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Duration: {h.duration ? `${h.duration}ms` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
