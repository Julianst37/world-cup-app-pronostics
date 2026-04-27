import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import app from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Solicita permiso de notificaciones push, obtiene el token FCM
 * y lo guarda en Firestore bajo users/{uid}/fcmTokens/{token}.
 * Solo se ejecuta si el navegador lo soporta y el usuario está autenticado.
 */
export async function registerFCMToken(currentUser) {
  if (!currentUser || !VAPID_KEY) return;

  try {
    const supported = await isSupported();
    if (!supported) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return;

    // Guardamos el token en una subcolección para soportar múltiples dispositivos
    await setDoc(
      doc(db, 'users', currentUser.uid, 'fcmTokens', token),
      {
        token,
        updatedAt: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 200),
      },
      { merge: true }
    );
  } catch (err) {
    // No interrumpir la experiencia si las notificaciones fallan
    console.warn('[FCM] No se pudo registrar el token:', err.message);
  }
}

export default registerFCMToken;
