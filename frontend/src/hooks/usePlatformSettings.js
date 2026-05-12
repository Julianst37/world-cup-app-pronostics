import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { DEFAULT_GLOBAL_ROUND_SETTINGS } from '../utils/constants';
import { invalidateMatchesCache } from './useMatches';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const DEFAULT_SETTINGS = {
  playoffRounds: DEFAULT_GLOBAL_ROUND_SETTINGS,
};

// Module-level cache: fetched once per app session
let settingsCache = null;
let settingsCachePromise = null;

// All mounted usePlatformSettings instances subscribe here to get notified on updates
const listeners = new Set();

function buildSettings(data) {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    playoffRounds: {
      ...DEFAULT_GLOBAL_ROUND_SETTINGS,
      ...(data?.playoffRounds || {}),
    },
  };
}

export function usePlatformSettings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(settingsCache || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!settingsCache);

  useEffect(() => {
    // Subscribe so this instance gets updated when any other instance calls updateSettings
    const onUpdate = (s) => { setSettings(s); setLoading(false); };
    listeners.add(onUpdate);

    if (settingsCache) {
      onUpdate(settingsCache);
      return () => listeners.delete(onUpdate);
    }

    if (!settingsCachePromise) {
      settingsCachePromise = fetch(`${API_BASE_URL}/api/platform-settings`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((data) => {
          settingsCache = buildSettings(data);
          return settingsCache;
        })
        .catch(() => {
          settingsCachePromise = null;
          return DEFAULT_SETTINGS;
        });
    }

    settingsCachePromise.then((s) => {
      setSettings(s);
      setLoading(false);
    });

    return () => listeners.delete(onUpdate);
  }, []);

  const updateSettings = useCallback(async (nextSettings) => {
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/platform-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(nextSettings),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Error al guardar configuración');
    }
    const saved = await res.json();
    settingsCache = buildSettings(saved);
    settingsCachePromise = null;
    // Invalidate matches cache so newly enabled rounds get re-fetched
    invalidateMatchesCache();
    // Notify all mounted instances
    listeners.forEach((fn) => fn(settingsCache));
  }, [currentUser]);

  return { settings, loading, updateSettings };
}

export default usePlatformSettings;
