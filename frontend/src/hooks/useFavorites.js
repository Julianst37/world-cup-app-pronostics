import { useState, useEffect, useCallback } from 'react';

const FAVORITES_STORAGE_KEY = 'matchFavorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFavorites(parsed);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
      setFavorites([]);
    }
  }, []);

  // Toggle favorite status for a match
  const toggleFavorite = useCallback((matchId) => {
    const matchIdStr = String(matchId);
    setFavorites(prev => {
      const isFav = prev.some(id => String(id) === matchIdStr);
      const newFavorites = isFav
        ? prev.filter(id => String(id) !== matchIdStr)
        : [...prev, matchIdStr];

      // Save to localStorage
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
      } catch (error) {
        console.error('Error saving favorites:', error);
      }

      return newFavorites;
    });
  }, []);

  // Check if a match is favorited
  const isFavorite = useCallback((matchId) => {
    const matchIdStr = String(matchId);
    return favorites.some(id => String(id) === matchIdStr);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

export default useFavorites;
