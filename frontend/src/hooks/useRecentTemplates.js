import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'logicbridge_recent_templates';
const MAX_RECENTS = 5;

/**
 * Reads stored recently used templates from localStorage
 * @returns {Array<{ id: string, name: string, icon?: string, category?: string, difficulty?: string, usedAt: string }>}
 */
export function getStoredRecentTemplates() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/**
 * Persists recently used templates to localStorage
 * @param {Array<object>} recents
 */
export function saveStoredRecentTemplates(recents) {
  try {
    if (typeof window !== 'undefined') {
      const sanitized = (Array.isArray(recents) ? recents : []).slice(0, MAX_RECENTS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    }
  } catch {
    // Storage quota or private browsing fallback
  }
}

/**
 * Hook to manage recently used templates with localStorage persistence
 */
export function useRecentTemplates() {
  const [recentTemplates, setRecentTemplates] = useState(() => getStoredRecentTemplates());

  // Cross-tab synchronization via storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        setRecentTemplates(getStoredRecentTemplates());
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  const addRecentTemplate = useCallback((template) => {
    if (!template || !template.id) return;
    setRecentTemplates((prev) => {
      const entry = {
        id: template.id,
        name: template.name || 'Untitled Template',
        icon: template.icon || 'Layers',
        category: template.category || 'getting-started',
        difficulty: template.difficulty || 'Beginner',
        usedAt: new Date().toISOString(),
      };
      const filtered = prev.filter((item) => item.id !== template.id);
      const next = [entry, ...filtered].slice(0, MAX_RECENTS);
      saveStoredRecentTemplates(next);
      return next;
    });
  }, []);

  const clearRecentTemplates = useCallback(() => {
    setRecentTemplates([]);
    saveStoredRecentTemplates([]);
  }, []);

  return {
    recentTemplates,
    addRecentTemplate,
    clearRecentTemplates,
  };
}

export default useRecentTemplates;

