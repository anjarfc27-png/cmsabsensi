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

// This handles the notification when the app is in the background
messaging.onBackgroundMessage((payload) => {
    console.log('Background Message:', payload);

    const title = payload.data?.title || payload.notification?.title || "CMS Absensi";
    const options = {
        body: payload.data?.body || payload.notification?.body || "Anda memiliki notifikasi baru",
        icon: "/logo.png",
        badge: "/logo.png",
        vibrate: [100, 50, 100],
        data: {
            url: payload.data?.url || '/'
        }
    };

    return self.registration.showNotification(title, options);
});

// Immediately take control
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
