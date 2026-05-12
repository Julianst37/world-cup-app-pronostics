import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { invalidateParticipantsCache } from './participantsCache';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const TOURNAMENTS_CACHE_TTL = 24 * 60 * 60 * 1000;
const tournamentsCache = new Map(); // uid → { data, ts }

export function invalidateTournamentsCache(uid) {
  if (uid) tournamentsCache.delete(uid);
}

async function apiFetch(path, idToken, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Error en la solicitud');
    err.code = data.code || null;
    throw err;
  }
  return data;
}

async function loadTournamentsForUser(uid, idToken) {
  const cached = tournamentsCache.get(uid);
  if (cached && Date.now() - cached.ts < TOURNAMENTS_CACHE_TTL) return cached.data;

  const data = await apiFetch('/api/tournaments', idToken);
  tournamentsCache.set(uid, { data, ts: Date.now() });
  return data;
}

export function useTournaments() {
  const { currentUser } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setTournaments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    currentUser.getIdToken().then((idToken) =>
      loadTournamentsForUser(currentUser.uid, idToken)
    ).then((data) => {
      setTournaments(data);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [currentUser]);

  const createTournament = useCallback(async (tournamentData) => {
    if (!currentUser) throw new Error('Must be logged in');
    const idToken = await currentUser.getIdToken();
    const tournament = await apiFetch('/api/tournaments', idToken, {
      method: 'POST',
      body: JSON.stringify(tournamentData),
    });
    invalidateTournamentsCache(currentUser.uid);
    return tournament.id;
  }, [currentUser]);

  const updateTournament = useCallback(async (tournamentId, data) => {
    if (!currentUser) throw new Error('Must be logged in');
    const idToken = await currentUser.getIdToken();
    await apiFetch(`/api/tournaments/${tournamentId}`, idToken, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    invalidateTournamentsCache(currentUser.uid);
  }, [currentUser]);

  const deleteTournament = useCallback(async (tournamentId) => {
    if (!currentUser) throw new Error('Must be logged in');
    const idToken = await currentUser.getIdToken();
    await apiFetch(`/api/tournaments/${tournamentId}`, idToken, { method: 'DELETE' });
    invalidateTournamentsCache(currentUser.uid);
    setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
  }, [currentUser]);

  const joinTournament = useCallback(async (inviteCode) => {
    if (!currentUser) throw new Error('Must be logged in');
    const idToken = await currentUser.getIdToken();
    const result = await apiFetch('/api/tournaments/join', idToken, {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
    invalidateTournamentsCache(currentUser.uid);
    // Refresh tournaments list immediately
    const data = await loadTournamentsForUser(currentUser.uid, idToken);
    setTournaments(data);
    return result;
  }, [currentUser]);

  const leaveTournament = useCallback(async (tournamentId) => {
    if (!currentUser) throw new Error('Must be logged in');
    const idToken = await currentUser.getIdToken();
    await apiFetch(`/api/tournaments/${tournamentId}/leave`, idToken, { method: 'POST' });
    invalidateTournamentsCache(currentUser.uid);
    invalidateParticipantsCache(tournamentId);
    setTournaments((prev) => prev.filter((t) => t.id !== tournamentId));
  }, [currentUser]);

  const getTournament = useCallback(async (tournamentId) => {
    if (currentUser) {
      const cached = tournamentsCache.get(currentUser.uid);
      if (cached && Date.now() - cached.ts < TOURNAMENTS_CACHE_TTL) {
        const found = cached.data.find((t) => t.id === tournamentId);
        if (found) return found;
      }
    }
    const idToken = await currentUser.getIdToken();
    return apiFetch(`/api/tournaments/${tournamentId}`, idToken);
  }, [currentUser]);

  const fetchTournaments = useCallback(async () => {
    if (!currentUser) return;
    invalidateTournamentsCache(currentUser.uid);
    const idToken = await currentUser.getIdToken();
    const data = await loadTournamentsForUser(currentUser.uid, idToken);
    setTournaments(data);
  }, [currentUser]);

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    leaveTournament,
    getTournament,
    fetchTournaments,
  };
}

export default useTournaments;
