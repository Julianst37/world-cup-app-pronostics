import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const PREDICTIONS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

// Module-level cache — survives navigation within same session
const predictionsMemCache = new Map(); // key → { data, ts }

function getCacheKey(uid, tournamentId) {
  return `predictions_${uid}_${tournamentId}`;
}

function readPredictionsCache(key) {
  const mem = predictionsMemCache.get(key);
  if (mem && Date.now() - mem.ts < PREDICTIONS_CACHE_TTL_MS) return mem.data;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > PREDICTIONS_CACHE_TTL_MS) return null;
    predictionsMemCache.set(key, { data, ts: Date.now() });
    return data;
  } catch (_) {
    return null;
  }
}

function writePredictionsCache(key, data) {
  predictionsMemCache.set(key, { data, ts: Date.now() });
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

export function usePredictions(tournamentId) {
  const { currentUser } = useAuth();
  const cacheKey = currentUser && tournamentId ? getCacheKey(currentUser.uid, tournamentId) : null;
  const [predictions, setPredictions] = useState(() => (cacheKey ? readPredictionsCache(cacheKey) || [] : []));
  const [loading, setLoading] = useState(() => !cacheKey || !readPredictionsCache(cacheKey));
  const [error, setError] = useState(null);

  const isPredictionLocked = (match, tournament) => {
    if (!match || !tournament) return false;
    if (match.status === 'finished') return true;

    const lockMinutes = tournament.predictionLockMinutes || 10;
    const rawTime = String(match.time || '00:00').slice(0, 5);
    const matchDate = new Date(`${match.date}T${rawTime}:00-05:00`);
    const lockDate = new Date(matchDate.getTime() - lockMinutes * 60 * 1000);

    return new Date() >= lockDate;
  };

  useEffect(() => {
    if (!currentUser || !tournamentId) {
      setPredictions([]);
      setLoading(false);
      return;
    }

    const key = getCacheKey(currentUser.uid, tournamentId);
    const cached = readPredictionsCache(key);
    if (cached) {
      setPredictions(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    currentUser.getIdToken().then((idToken) =>
      fetch(`${API_BASE_URL}/api/predictions?tournamentId=${tournamentId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      })
    ).then((r) => r.json())
      .then((data) => {
        setPredictions(data);
        writePredictionsCache(key, data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [currentUser, tournamentId]);

  const savePrediction = useCallback(
    async (matchId, homeScore, awayScore) => {
      if (!currentUser || !tournamentId) throw new Error('Missing required fields');

      const idToken = await currentUser.getIdToken();

      const response = await fetch(`${API_BASE_URL}/api/predictions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tournamentId,
          matchId,
          homeScore: homeScore ?? null,
          awayScore: awayScore ?? null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail ? `${data.message}: ${data.detail}` : data.message || 'Error al guardar el pronóstico');
      }

      // Update local state and cache directly — no Firestore read needed
      const matchIdStr = String(matchId);
      const predId = `${currentUser.uid}_${tournamentId}_${matchIdStr}`;
      setPredictions((prev) => {
        const existing = prev.find((p) => String(p.matchId) === matchIdStr);
        let updated;
        if (existing) {
          updated = prev.map((p) =>
            String(p.matchId) === matchIdStr
              ? { ...p, prediction: { homeScore, awayScore } }
              : p
          );
        } else {
          updated = [
            ...prev,
            {
              id: predId,
              userId: currentUser.uid,
              tournamentId,
              matchId: matchIdStr,
              prediction: { homeScore, awayScore },
              points: null,
            },
          ];
        }
        writePredictionsCache(getCacheKey(currentUser.uid, tournamentId), updated);
        return updated;
      });
    },
    [currentUser, tournamentId]
  );

  const getPredictionForMatch = useCallback(
    (matchId) => {
      const matchIdStr = String(matchId);
      return predictions.find((p) => String(p.matchId) === matchIdStr) || null;
    },
    [predictions]
  );

  const clearPrediction = useCallback(
    async (matchId) => {
      if (!currentUser || !tournamentId) return;
      const matchIdStr = String(matchId);
      const idToken = await currentUser.getIdToken();
      await fetch(`${API_BASE_URL}/api/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ tournamentId, matchId: matchIdStr, homeScore: null, awayScore: null }),
      });

      // Update local state and cache
      setPredictions((prev) => {
        const updated = prev.filter((p) => String(p.matchId) !== matchIdStr);
        writePredictionsCache(getCacheKey(currentUser.uid, tournamentId), updated);
        return updated;
      });
    },
    [currentUser, tournamentId]
  );

  const clearAllPredictions = useCallback(
    async (matchIds) => {
      if (!currentUser || !tournamentId) return;
      await Promise.all(matchIds.map((matchId) => clearPrediction(matchId)));
    },
    [currentUser, tournamentId, clearPrediction]
  );

  const refreshPredictions = useCallback(async () => {
    if (!currentUser || !tournamentId) return;
    const key = getCacheKey(currentUser.uid, tournamentId);
    predictionsMemCache.delete(key);
    try { localStorage.removeItem(key); } catch (_) {}
    const idToken = await currentUser.getIdToken();
    const data = await fetch(`${API_BASE_URL}/api/predictions?tournamentId=${tournamentId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    }).then((r) => r.json());
    setPredictions(data);
    writePredictionsCache(key, data);
  }, [currentUser, tournamentId]);

  return { predictions, loading, error, savePrediction, isPredictionLocked, getPredictionForMatch, clearPrediction, clearAllPredictions, refreshPredictions };
}

export default usePredictions;
