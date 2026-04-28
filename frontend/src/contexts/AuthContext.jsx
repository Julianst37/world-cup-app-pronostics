import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../config/firebase';
import { registerFCMToken } from '../hooks/usePushNotifications';

const AuthContext = createContext(null);
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'wc-last-activity-at';
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimeoutRef = useRef(null);
  const activityEventsBoundRef = useRef(false);
  const autoLogoutInProgressRef = useRef(false);

  function clearInactivityTimeout() {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }

  async function performAutoLogout() {
    if (autoLogoutInProgressRef.current) {
      return;
    }

    autoLogoutInProgressRef.current = true;
    clearInactivityTimeout();

    try {
      await signOut(auth);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      setUserProfile(null);
      toast.error('Tu sesión se cerró por 30 minutos de inactividad');
    } finally {
      autoLogoutInProgressRef.current = false;
    }
  }

  function scheduleAutoLogout() {
    clearInactivityTimeout();
    inactivityTimeoutRef.current = setTimeout(() => {
      performAutoLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }

  function registerActivity() {
    if (!auth.currentUser) {
      return;
    }

    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    scheduleAutoLogout();
  }

  function removeActivityListeners() {
    if (!activityEventsBoundRef.current || typeof window === 'undefined') {
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, registerActivity);
    });

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    activityEventsBoundRef.current = false;
  }

  function bindActivityListeners() {
    if (activityEventsBoundRef.current || typeof window === 'undefined') {
      return;
    }

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    activityEventsBoundRef.current = true;
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible' || !auth.currentUser) {
      return;
    }

    const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    if (lastActivityAt && Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
      performAutoLogout();
      return;
    }

    registerActivity();
  }

  function startInactivityTracking() {
    const lastActivityAt = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || 0);

    if (lastActivityAt && Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS) {
      performAutoLogout();
      return;
    }

    bindActivityListeners();
    registerActivity();
  }

  function stopInactivityTracking() {
    clearInactivityTimeout();
    removeActivityListeners();
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }

  function normalizeUsernameSeed(value) {
    const normalizedValue = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_');

    return normalizedValue || 'usuario';
  }

  async function generateUniqueUsername(baseValue, currentUid) {
    const baseUsername = normalizeUsernameSeed(baseValue).slice(0, 20) || 'usuario';
    let nextUsername = baseUsername;
    let suffix = 1;

    while (true) {
      const usernameQuery = query(collection(db, 'users'), where('username', '==', nextUsername));
      const usernameSnapshot = await getDocs(usernameQuery);
      const usernameTaken = usernameSnapshot.docs.some((snapshotDoc) => snapshotDoc.id !== currentUid);

      if (!usernameTaken) {
        return nextUsername;
      }

      const suffixText = String(suffix);
      nextUsername = `${baseUsername.slice(0, Math.max(20 - suffixText.length, 1))}${suffixText}`;
      suffix += 1;
    }
  }

  async function ensureUserProfile(user, extraData = {}) {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const existingData = userDoc.exists() ? userDoc.data() : {};

    let username = existingData.username || '';
    if (!username) {
      username = await generateUniqueUsername(
        extraData.username || user.displayName || user.email?.split('@')[0] || user.uid,
        user.uid
      );
    }

    const profileData = {
      uid: user.uid,
      email: user.email || existingData.email || '',
      displayName: extraData.displayName || user.displayName || existingData.displayName || '',
      username,
      favoriteTeam: extraData.favoriteTeam ?? existingData.favoriteTeam ?? '',
      firstName: existingData.firstName || '',
      lastName: existingData.lastName || '',
      photoURL: user.photoURL || existingData.photoURL || null,
      isActive: existingData.isActive ?? true,
      isAdmin: existingData.isAdmin ?? false,
      passwordChangeCount: existingData.passwordChangeCount ?? 0,
      passwordChangeLimit: existingData.passwordChangeLimit ?? 3,
      lastPasswordChangedAt: existingData.lastPasswordChangedAt ?? null,
      createdAt: existingData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, profileData, { merge: true });
    return profileData;
  }

  async function signup(email, password, displayName, username) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName });

    await ensureUserProfile(user, {
      email,
      displayName,
      username,
    });

    return userCredential;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const userCredential = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(userCredential.user);
    return userCredential;
  }

  async function logout() {
    stopInactivityTracking();
    await signOut(auth);
    setUserProfile(null);
  }

  async function resetPassword(email) {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'No fue posible enviar el correo de recuperación');
    }

    return payload;
  }

  async function updateUserProfile(data) {
    if (!currentUser) throw new Error('No user logged in');

    if (data.displayName) {
      await updateProfile(currentUser, { displayName: data.displayName });
    }

    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    const updated = await getDoc(userRef);
    setUserProfile(updated.data());
  }

  async function updateUserEmail(newEmail, currentPassword) {
    if (!currentUser) throw new Error('No user logged in');
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);
    await updateEmail(currentUser, newEmail);
    await updateDoc(doc(db, 'users', currentUser.uid), {
      email: newEmail,
      updatedAt: serverTimestamp(),
    });
  }

  async function updateUserPassword(currentPassword, newPassword) {
    if (!currentUser) throw new Error('No user logged in');
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, credential);

    const idToken = await currentUser.getIdToken(true);
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken, newPassword }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || 'No fue posible cambiar la contraseña');
    }

    await fetchUserProfile(currentUser.uid);
    return payload;
  }

  async function fetchUserProfile(uid) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      setUserProfile(userDoc.data());
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
        startInactivityTracking();
        registerFCMToken(user);
      } else {
        stopInactivityTracking();
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      stopInactivityTracking();
    };
  }, []);

  const value = {
    currentUser,
    userProfile,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
