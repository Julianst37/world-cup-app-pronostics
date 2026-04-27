import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function usePredictions(tournamentId) {
  const { currentUser } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isPredictionLocked = (match, tournament) => {
    if (!match || !tournament) return false;
    if (match.status === 'finished') return true;

    const lockMinutes = tournament.predictionLockMinutes || 10;
    // Interpret stored date/time as Colombia local time (UTC-5) with an explicit
    // offset so the UI lock indicator is correct for all users regardless of their
    // browser timezone or VPN.
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

    setLoading(true);
    const q = query(
      collection(db, 'predictions'),
      where('userId', '==', currentUser.uid),
      where('tournamentId', '==', tournamentId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPredictions(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser, tournamentId]);

  const savePrediction = useCallback(
    async (matchId, homeScore, awayScore) => {
      if (!currentUser || !tournamentId) throw new Error('Missing required fields');

      // Obtain a fresh ID token so the backend can verify identity server-side.
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
        throw new Error(data.message || 'Error al guardar el pronóstico');
      }
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

  return { predictions, loading, error, savePrediction, getPredictionForMatch };
}

export default usePredictions;
