/**
 * Shared participants + standings cache — module-level + localStorage.
 *
 * Invalidation:
 *   - Admin finalizes/clears a match  -> clearAllParticipantsLocalStorage() (via useMatches)
 *   - Admin changes participant status -> invalidateParticipantsCache(tournamentId)
 *   - Admin removes participant        -> invalidateParticipantsCache(tournamentId)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PARTICIPANTS_LS_PREFIX = 'participants_cache_';
const USER_PROFILE_LS_PREFIX = 'user_profile_cache_';

// tournamentId -> { data: Participant[], ts: number }
const participantsCache = new Map();

// userId -> UserProfile (module-level, survives navigation)
export const userProfileCache = new Map();

// ─── Invalidation ─────────────────────────────────────────────────────────────

export function invalidateParticipantsCache(tournamentId) {
  if (tournamentId) {
    participantsCache.delete(tournamentId);
    try {
      localStorage.removeItem(PARTICIPANTS_LS_PREFIX + tournamentId);
    } catch (_) {}
  }
}

export function clearAllParticipantsLocalStorage() {
  participantsCache.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PARTICIPANTS_LS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (_) {}
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

function readParticipantsLS(tournamentId) {
  try {
    const raw = localStorage.getItem(PARTICIPANTS_LS_PREFIX + tournamentId);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return { data, ts };
  } catch (_) { return null; }
}

function writeParticipantsLS(tournamentId, data) {
  try {
    localStorage.setItem(PARTICIPANTS_LS_PREFIX + tournamentId, JSON.stringify({ data, ts: Date.now() }));
  } catch (_) {}
}

// ─── User Profiles ─────────────────────────────────────────────────────────────

export function invalidateUserProfileCache(userId) {
  userProfileCache.delete(userId);
  try {
    localStorage.removeItem(USER_PROFILE_LS_PREFIX + userId);
  } catch (_) {}
}

export async function fetchUserProfile(userId, idToken) {
  // 1. Memory
  if (userProfileCache.has(userId)) return userProfileCache.get(userId);

  // 2. localStorage
  try {
    const raw = localStorage.getItem(USER_PROFILE_LS_PREFIX + userId);
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) {
        userProfileCache.set(userId, data);
        return data;
      }
    }
  } catch (_) {}

  // 3. REST API
  const fallback = { displayName: 'Usuario', username: '', email: '' };
  if (!idToken) return fallback;
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const profile = res.ok ? await res.json() : fallback;
    userProfileCache.set(userId, profile);
    try {
      localStorage.setItem(USER_PROFILE_LS_PREFIX + userId, JSON.stringify({ data: profile, ts: Date.now() }));
    } catch (_) {}
    return profile;
  } catch (_) {
    return fallback;
  }
}

// ─── Participants ──────────────────────────────────────────────────────────────

export async function loadParticipants(tournamentId, idToken) {
  // 1. Memory
  const mem = participantsCache.get(tournamentId);
  if (mem && Date.now() - mem.ts < CACHE_TTL) return mem.data;

  // 2. localStorage
  const ls = readParticipantsLS(tournamentId);
  if (ls) {
    participantsCache.set(tournamentId, ls);
    return ls.data;
  }

  // 3. REST API
  if (!idToken) return [];
  const res = await fetch(`${API_BASE_URL}/api/tournaments/${tournamentId}/participants`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  // Normalize to same shape as before: flat participant with user fields merged
  const normalized = data.map((p) => ({
    id: p.id,
    userId: p.userId,
    tournamentId: p.tournamentId,
    status: p.status,
    role: p.role,
    points: p.points,
    joinedAt: p.joinedAt,
    displayName: p.user?.displayName || '',
    username: p.user?.username || '',
    photoURL: p.user?.photoURL || null,
    favoriteTeam: p.user?.favoriteTeam || null,
    email: p.user?.email || '',
  }));
  participantsCache.set(tournamentId, { data: normalized, ts: Date.now() });
  writeParticipantsLS(tournamentId, normalized);
  return normalized;
}

// ─── Standings Doc ─────────────────────────────────────────────────────────────

// writeStandingsDoc kept for API compatibility (called after recalculate)
export function writeStandingsDoc(tournamentId, entries) {
  // No caching — standings are always fetched fresh from the API
}

export async function loadStandingsDoc(tournamentId, idToken) {
  // Always fetch fresh from API — no cache
  if (!idToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/standings/${tournamentId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const { entries } = await res.json();
    return entries;
  } catch (_) {
    return null;
  }
}
