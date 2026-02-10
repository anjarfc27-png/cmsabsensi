// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker with the real config
firebase.initializeApp({
    apiKey: "AIzaSyDeuXMVp1Y4Ss-Py4-qeTlZYqDk-s7Xg-s",
    authDomain: "cmsabsensibenar.firebaseapp.com",
    projectId: "cmsabsensibenar",
    storageBucket: "cmsabsensibenar.firebasestorage.app",
    messagingSenderId: "1005997535417",
    appId: "1:1005997535417:web:b73c7477ea5af5134d2b68",
    measurementId: "G-E9V7ZGM5FH"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    // Extract notification details from the payload
    // FCM v1 often puts them in payload.notification or payload.data
    const title = payload.notification?.title || payload.data?.title || "CMS Absensi";
    const body = payload.notification?.body || payload.data?.body || "Ada pesan baru untuk Anda.";

    const notificationOptions = {
        body: body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'absensi-notif', // prevents duplicates
        renotify: true,
        data: payload.data,
        vibrate: [200, 100, 200]
    };

    return self.registration.showNotification(title, notificationOptions);
});

// Self-replace logic to ensure it updates immediately
self.addEventListener('install', () => {
    self.skipWaiting();
});
