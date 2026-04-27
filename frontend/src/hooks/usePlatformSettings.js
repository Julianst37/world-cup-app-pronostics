import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  DEFAULT_GLOBAL_ROUND_SETTINGS,
  PLATFORM_COLLECTION,
  PLATFORM_SETTINGS_DOC,
} from '../utils/constants';

const DEFAULT_SETTINGS = {
  playoffRounds: DEFAULT_GLOBAL_ROUND_SETTINGS,
};

export function usePlatformSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, PLATFORM_COLLECTION, PLATFORM_SETTINGS_DOC);

    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSettings(DEFAULT_SETTINGS);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          playoffRounds: {
            ...DEFAULT_GLOBAL_ROUND_SETTINGS,
            ...(data.playoffRounds || {}),
          },
        });
        setLoading(false);
      },
      () => {
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const updateSettings = useCallback(async (nextSettings) => {
    const settingsRef = doc(db, PLATFORM_COLLECTION, PLATFORM_SETTINGS_DOC);
    await setDoc(settingsRef, nextSettings, { merge: true });
  }, []);

  return { settings, loading, updateSettings };
}

export default usePlatformSettings;