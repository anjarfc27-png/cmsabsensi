// Minimalist & Robust Service Worker for FCM
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDeuXMVp1Y4Ss-Py4-qeTlZYqDk-s7Xg-s",
    authDomain: "cmsabsensibenar.firebaseapp.com",
    projectId: "cmsabsensibenar",
    storageBucket: "cmsabsensibenar.firebasestorage.app",
    messagingSenderId: "1005997535417",
    appId: "1:1005997535417:web:b73c7477ea5af5134d2b68"
});

const messaging = firebase.messaging();

// Handles background FCM messages (app not in foreground)
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background Message received:', payload);

    const notifData = payload.data || {};
    const notifTitle = notifData.title || payload.notification?.title || 'CMS Absensi';
    const notifBody = notifData.body || payload.notification?.body || 'Anda memiliki notifikasi baru';
    // Support navigating to a specific route when the notification is clicked
    const notifLink = notifData.link || notifData.url || '/';

    const options = {
        body: notifBody,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [100, 50, 100],
        data: { url: notifLink },
        // Prevent duplicate notifications when FCM also provides a notification block
        tag: notifData.notification_id || 'cms-push-' + Date.now(),
    };

    return self.registration.showNotification(notifTitle, options);
});

// Handle notification click: open/focus the correct tab
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If a window with the same origin is already open, focus it and navigate
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.focus();
                    return client.navigate(targetUrl);
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// Immediately take control of the page
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => clients.claim());

// Handler for periodic sync (keep-alive lure)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'fcm-heartbeat') {
        console.log('[SW] Periodic heartbeat event triggered');
        // No specific action needed, just the act of waking up helps stay registered
    }
});
