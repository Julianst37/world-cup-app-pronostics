import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export function useMatches(filters = {}) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    let q = collection(db, 'matches');
    const constraints = [orderBy('date', 'asc')];

    if (filters.round) {
      constraints.unshift(where('round', '==', filters.round));
    }
    if (filters.group) {
      constraints.unshift(where('group', '==', filters.group));
    }
    if (filters.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

    q = query(q, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [filters.round, filters.group, filters.status]);

  const getMatch = useCallback(async (matchId) => {
    const docRef = doc(db, 'matches', matchId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  }, []);

  return { matches, loading, error, getMatch };
}

export default useMatches;
