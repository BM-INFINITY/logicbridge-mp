import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'logicbridge_template_favorites';

/**
 * Reads stored favorite template IDs from localStorage
 * @returns {Array<string>}
 */
export function getStoredFavorites() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists favorite template IDs to localStorage
 * @param {Array<string>} favorites
 */
export function saveStoredFavorites(favorites) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  } catch {
    // Storage quota or private browsing fallback
  }
}

/**
 * Hook to manage template bookmarking/favoriting with localStorage persistence
 */
export function useTemplateFavorites() {
  const [favorites, setFavorites] = useState(() => getStoredFavorites());

  // Cross-tab synchronization via storage event
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        setFavorites(getStoredFavorites());
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  const toggleFavorite = useCallback((templateId) => {
    setFavorites((prev) => {
      const next = prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId];
      saveStoredFavorites(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (templateId) => favorites.includes(templateId),
    [favorites]
  );

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
}

export default useTemplateFavorites;

