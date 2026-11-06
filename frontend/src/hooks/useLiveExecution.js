import { useState, useEffect, useRef, useCallback } from 'react';
import API from '../api/client';

const TERMINAL_STATUSES = new Set(['success', 'failed', 'waiting_approval', 'paused', 'cancelled', 'expired']);

/**
 * Custom hook for live execution tracking and polling
 * @param {string|null} executionId
 * @param {object|null} initialExecution
 * @param {object} options - { pollInterval: number, enabled: boolean, onStatusChange: function }
 */
export default function useLiveExecution(executionId, initialExecution = null, options = {}) {
  const {
    pollInterval = 1500,
    enabled = true,
    onStatusChange = null,
  } = options;

  const [execution, setExecution] = useState(initialExecution);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);

  const prevStatusRef = useRef(initialExecution?.status || null);
  const consecutiveErrorsRef = useRef(0);
  const timeoutIdRef = useRef(null);

  // Update state when initialExecution changes
  useEffect(() => {
    if (initialExecution) {
      setExecution(initialExecution);
      prevStatusRef.current = initialExecution.status;
    }
  }, [initialExecution]);

  const poll = useCallback(async () => {
    const id = executionId || execution?._id;
    if (!id || !enabled) return;

    // Check if terminal
    if (execution?.status && TERMINAL_STATUSES.has(execution.status)) {
      setIsLive(false);
      return;
    }

    try {
      const res = await API.get(`/api/executions/detail/${id}`);
      const updated = res.data?.data || res.data;

      consecutiveErrorsRef.current = 0;
      setError(null);
      setExecution(updated);

      if (onStatusChange && updated.status !== prevStatusRef.current) {
        onStatusChange(updated.status, prevStatusRef.current, updated);
        prevStatusRef.current = updated.status;
      }

      // If finished, stop polling
      if (TERMINAL_STATUSES.has(updated.status)) {
        setIsLive(false);
        return;
      }

      setIsLive(true);
      // Schedule next poll
      timeoutIdRef.current = setTimeout(poll, pollInterval);
    } catch (err) {
      consecutiveErrorsRef.current++;
      setError(err);

      // Backoff if failing repeatedly
      const backoff = Math.min(pollInterval * Math.pow(1.5, consecutiveErrorsRef.current), 10000);
      timeoutIdRef.current = setTimeout(poll, backoff);
    }
  }, [executionId, execution?._id, execution?.status, enabled, pollInterval, onStatusChange]);

  useEffect(() => {
    const id = executionId || initialExecution?._id;
    const isTerminal = initialExecution?.status && TERMINAL_STATUSES.has(initialExecution.status);

    if (enabled && id && !isTerminal) {
      setIsLive(true);
      timeoutIdRef.current = setTimeout(poll, pollInterval);
    } else {
      setIsLive(false);
    }

    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [executionId, initialExecution?._id, initialExecution?.status, enabled, pollInterval, poll]);

  // Page visibility API listener to suspend polling when user is on another tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      } else {
        if (isLive) poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isLive, poll]);

  const refreshNow = useCallback(async () => {
    const id = executionId || execution?._id;
    if (!id) return;
    try {
      const res = await API.get(`/api/executions/detail/${id}`);
      const updated = res.data?.data || res.data;
      setExecution(updated);
      return updated;
    } catch (err) {
      setError(err);
    }
  }, [executionId, execution?._id]);

  return {
    execution,
    isLive,
    error,
    refreshNow,
    setExecution,
  };
}
