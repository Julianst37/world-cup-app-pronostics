import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { clearAllParticipantsLocalStorage } from './participantsCache';

const MATCHES_CACHE_KEY = 'matches_cache';
const MATCHES_VERSION_KEY = 'matches_version';
const MATCHES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — version system handles freshness

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Module-level in-memory cache — survives component unmount/remount (navigation)
// without hitting Firestore again until the version changes or TTL expires
const memCache = new Map(); // cacheKey → { data, version, ts }
let knownServerVersion = null; // last version confirmed from Firestore
let versionFetchPromise = null; // deduplicate concurrent version checks

function readMatchesCache(cacheKey) {
  try {
    // Memory first (zero cost, survives navigation within same session)
    const mem = memCache.get(cacheKey);
    if (mem && Date.now() - mem.ts < MATCHES_CACHE_TTL_MS) return mem;
    // Fallback to localStorage (survives browser close/reopen)
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const { ts, data, version } = JSON.parse(raw);
    if (Date.now() - ts > MATCHES_CACHE_TTL_MS) return null;
    const entry = { data, version, ts };
    memCache.set(cacheKey, entry); // warm memory cache
    return entry;
  } catch (_) {
    return null;
  }
}

function writeMatchesCache(cacheKey, data, version) {
  const entry = { data, version, ts: Date.now() };
  memCache.set(cacheKey, entry);
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (_) {}
}

// Called by admin after modifying a match.
// Pass the updated match object for a surgical cache patch (no re-fetch).
// Pass null to force a full re-fetch on all clients (e.g. bulk operations).
export async function bumpMatchesVersion(idToken, updatedMatch = null) {
  knownServerVersion = null;
  versionFetchPromise = null;
  // Version is bumped server-side on PUT /api/matches/:id — nothing to do here
  // This function is kept for call-site compatibility
}

// Clears all matches-related cache keys from localStorage and memory
export function invalidateMatchesCache() {
  memCache.clear();
  knownServerVersion = null;
  versionFetchPromise = null;
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(MATCHES_CACHE_KEY));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

async function getServerVersion(idToken) {
  if (!versionFetchPromise) {
    versionFetchPromise = fetch(`${API_BASE_URL}/api/matches/version`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((r) => (r.ok ? r.json() : { ts: null, updatedMatchId: null, updatedMatchData: null }))
      .then((data) => {
        versionFetchPromise = null;
        const result = {
          ts: data.ts ?? null,
          updatedMatch: data.updatedMatchId ? { id: data.updatedMatchId, ...data.updatedMatchData } : null,
        };
        knownServerVersion = result.ts;
        return result;
      })
      .catch(() => {
        versionFetchPromise = null;
        return { ts: null, updatedMatch: null };
      });
  }
  return versionFetchPromise;
}

// Reads a single match from the module-level memory cache (or localStorage fallback).
// Returns the match object if found in any cached entry, null otherwise.
// Used by recalculateTournamentPointsForMatch to avoid Firestore reads for already-cached matches.
export function getMatchFromCache(matchId) {
  for (const entry of memCache.values()) {
    if (!entry?.data) continue;
    const found = entry.data.find((m) => m.id === matchId);
    if (found) return found;
  }
  // Fallback: scan localStorage entries
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(MATCHES_CACHE_KEY));
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const { data } = JSON.parse(raw);
      const found = data?.find((m) => m.id === matchId);
      if (found) return found;
    }
  } catch (_) {}
  return null;
}

export function useMatches(filters = {}) {
  const { currentUser } = useAuth();
  // filters.rounds = string[] → fetch only those rounds
  // filters.rounds = null    → settings not yet ready, defer fetch
  // filters.rounds = undefined (default) → no round filter, fetch all
  const roundsKey = Array.isArray(filters.rounds) ? filters.rounds.slice().sort().join(',') : (filters.rounds === null ? '__pending__' : '');
  const cacheKey = `${MATCHES_CACHE_KEY}_${roundsKey}_${filters.round || ''}_${filters.group || ''}_${filters.status || ''}`;
  const cached = readMatchesCache(cacheKey);
  const [matches, setMatches] = useState(() => cached?.data || []);
  const [loading, setLoading] = useState(() => filters.rounds === null ? true : !cached?.data);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const invalidate = useCallback(() => {
    invalidateMatchesCache();
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (filters.rounds === null) return;
    if (!currentUser) return;

    let cancelled = false;

    async function load() {
      const idToken = await currentUser.getIdToken();
      const cached = readMatchesCache(cacheKey);

      if (cached?.data) {
        if (knownServerVersion !== null && knownServerVersion === cached.version) {
          setMatches(cached.data);
          setLoading(false);
          return;
        }

        const { ts: serverTs, updatedMatch } = await getServerVersion(idToken);
        if (cancelled) return;

        if (serverTs === null || serverTs === cached.version) {
          setMatches(cached.data);
          setLoading(false);
          return;
        }

        if (updatedMatch?.id) {
          const patched = cached.data.map((m) =>
            m.id === updatedMatch.id ? { ...m, ...updatedMatch } : m
          );
          const changed = patched.some((m, i) => m !== cached.data[i]);
          if (changed) {
            setMatches(patched);
            writeMatchesCache(cacheKey, patched, serverTs);
          } else {
            setMatches(cached.data);
          }
          clearAllParticipantsLocalStorage();
          setLoading(false);
          return;
        }
      }

      if (!cancelled) setLoading(true);

      try {
        const params = new URLSearchParams();
        if (Array.isArray(filters.rounds) && filters.rounds.length > 0) params.set('rounds', filters.rounds.join(','));
        if (filters.round) params.set('round', filters.round);
        if (filters.group) params.set('group', filters.group);
        if (filters.status) params.set('status', filters.status);

        const [matchesRes, versionData] = await Promise.all([
          fetch(`${API_BASE_URL}/api/matches?${params}`, { headers: { Authorization: `Bearer ${idToken}` } }),
          getServerVersion(idToken),
        ]);
        if (cancelled) return;
        if (!matchesRes.ok) throw new Error('Error al obtener los partidos');
        const data = await matchesRes.json();
        setMatches(data);
        writeMatchesCache(cacheKey, data, versionData.ts);
        clearAllParticipantsLocalStorage();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [filters.rounds, filters.round, filters.group, filters.status, cacheKey, currentUser, tick]);

  const getMatch = useCallback(async (matchId) => {
    const fromCache = getMatchFromCache(matchId);
    if (fromCache) return fromCache;
    if (!currentUser) return null;
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/matches?`, { headers: { Authorization: `Bearer ${idToken}` } });
    // Fallback: scan all matches (shouldn't be needed given cache)
    if (!res.ok) return null;
    const all = await res.json();
    return all.find((m) => m.id === matchId) || null;
  }, [currentUser]);

  return { matches, loading, error, getMatch, invalidate };
}

export default useMatches;
