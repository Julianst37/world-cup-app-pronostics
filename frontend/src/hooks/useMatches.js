import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const MATCHES_CACHE_KEY = 'matches_cache';
const MATCHES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function readMatchesCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > MATCHES_CACHE_TTL_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function writeMatchesCache(cacheKey, data) {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
  } catch (_) {}
}

export function useMatches(filters = {}) {
  const cacheKey = `${MATCHES_CACHE_KEY}_${filters.round || ''}_${filters.group || ''}_${filters.status || ''}`;
  const [matches, setMatches] = useState(() => readMatchesCache(cacheKey) || []);
  const [loading, setLoading] = useState(() => !readMatchesCache(cacheKey));
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = readMatchesCache(cacheKey);
    if (cached) {
      setMatches(cached);
      setLoading(false);
      return;
    }

    setLoading(true);

    const constraints = [orderBy('date', 'asc')];
    if (filters.round) constraints.unshift(where('round', '==', filters.round));
    if (filters.group) constraints.unshift(where('group', '==', filters.group));
    if (filters.status) constraints.unshift(where('status', '==', filters.status));

    const q = query(collection(db, 'matches'), ...constraints);

    getDocs(q)
      .then((snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(data);
        writeMatchesCache(cacheKey, data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [filters.round, filters.group, filters.status, cacheKey]);

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
