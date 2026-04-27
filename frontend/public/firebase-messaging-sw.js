// Service Worker para Firebase Cloud Messaging
// Este archivo DEBE estar en la raíz del dominio (public/)
// y no puede usar import.meta.env — los valores se inyectan en build time
// via el script de reemplazo en vite.config.js

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '__VITE_FIREBASE_API_KEY__',
  authDomain: '__VITE_FIREBASE_AUTH_DOMAIN__',
  projectId: '__VITE_FIREBASE_PROJECT_ID__',
  storageBucket: '__VITE_FIREBASE_STORAGE_BUCKET__',
  messagingSenderId: '__VITE_FIREBASE_MESSAGING_SENDER_ID__',
  appId: '__VITE_FIREBASE_APP_ID__',
});

const messaging = firebase.messaging();

// Notificaciones en background (app cerrada / minimizada)
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, data } = payload.notification ?? {};

  self.registration.showNotification(title || 'Mundial 2026', {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data ?? {},
    vibrate: [200, 100, 200],
  });
});

// Click en la notificación — abre la URL si viene en data.url
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
