import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './useAuth';

export function usePredictions(tournamentId) {
  const { currentUser } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      const predictionId = `${currentUser.uid}_${tournamentId}_${matchId}`;
      const predictionRef = doc(db, 'predictions', predictionId);

      await setDoc(
        predictionRef,
        {
          userId: currentUser.uid,
          matchId,
          tournamentId,
          prediction: { homeScore, awayScore },
          points: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    [currentUser, tournamentId]
  );

  const getPredictionForMatch = useCallback(
    (matchId) => {
      return predictions.find((p) => p.matchId === matchId) || null;
    },
    [predictions]
  );

  return { predictions, loading, error, savePrediction, getPredictionForMatch };
}

export default usePredictions;
