import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  DEFAULT_GLOBAL_ROUND_SETTINGS,
  PLATFORM_COLLECTION,
  PLATFORM_SETTINGS_DOC,
} from '../utils/constants';

const DEFAULT_SETTINGS = {
  playoffRounds: DEFAULT_GLOBAL_ROUND_SETTINGS,
};

// Module-level cache: fetched once per app session
let settingsCache = null;
let settingsCachePromise = null;

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
  const [settings, setSettings] = useState(settingsCache || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!settingsCache);

  useEffect(() => {
    if (settingsCache) {
      setSettings(settingsCache);
      setLoading(false);
      return;
    }

    if (!settingsCachePromise) {
      const ref = doc(db, PLATFORM_COLLECTION, PLATFORM_SETTINGS_DOC);
      settingsCachePromise = getDoc(ref)
        .then((snap) => {
          settingsCache = buildSettings(snap.exists() ? snap.data() : {});
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
  }, []);

  const updateSettings = useCallback(async (nextSettings) => {
    const ref = doc(db, PLATFORM_COLLECTION, PLATFORM_SETTINGS_DOC);
    await setDoc(ref, nextSettings, { merge: true });
    // Invalidate cache so next read picks up the change
    settingsCache = buildSettings(nextSettings);
    settingsCachePromise = null;
    setSettings(settingsCache);
  }, []);

  return { settings, loading, updateSettings };
}

export default usePlatformSettings;