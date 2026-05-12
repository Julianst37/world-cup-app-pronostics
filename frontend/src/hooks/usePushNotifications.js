import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import app from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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

    // If already denied, don't prompt — browser will block it anyway
    if (Notification.permission === 'denied') return;

    // Only request if not yet granted (requires a user gesture in modern browsers)
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) return;

    // Guardamos el token en el backend para soportar múltiples dispositivos
    const idToken = await currentUser.getIdToken();
    await fetch(`${API_BASE_URL}/api/fcm/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    // No interrumpir la experiencia si las notificaciones fallan
    console.warn('[FCM] No se pudo registrar el token:', err.message);
  }
}

export default registerFCMToken;
