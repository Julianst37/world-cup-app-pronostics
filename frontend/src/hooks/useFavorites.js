import { useState, useEffect, useCallback } from 'react';

const FAVORITES_STORAGE_PREFIX = 'matchFavorites';

// Generar clave única por usuario + torneo
const getStorageKey = (userId, tournamentId) => {
  return `${FAVORITES_STORAGE_PREFIX}_${userId}_${tournamentId}`;
};

export function useFavorites(userId, tournamentId) {
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (!userId || !tournamentId) {
      setFavorites([]);
      return;
    }

    try {
      const storageKey = getStorageKey(userId, tournamentId);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFavorites(parsed);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      setFavorites([]);
    }
  }, [userId, tournamentId]);

  // Toggle favorite status for a match
  const toggleFavorite = useCallback((matchId) => {
    if (!userId || !tournamentId) {
      console.warn('userId y tournamentId son requeridos para manejar favoritos');
      return;
    }

    const matchIdStr = String(matchId);
    setFavorites(prev => {
      const isFav = prev.some(id => String(id) === matchIdStr);
      const newFavorites = isFav
        ? prev.filter(id => String(id) !== matchIdStr)
        : [...prev, matchIdStr];

      // Save to localStorage
      try {
        const storageKey = getStorageKey(userId, tournamentId);
        localStorage.setItem(storageKey, JSON.stringify(newFavorites));
      } catch (error) {
        console.error('Error saving favorites:', error);
      }

      return newFavorites;
    });
  }, [userId, tournamentId]);

  // Check if a match is favorited
  const isFavorite = useCallback((matchId) => {
    const matchIdStr = String(matchId);
    return favorites.some(id => String(id) === matchIdStr);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}


export default useFavorites;
