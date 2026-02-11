import { useEffect, useRef } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config should match your project
const firebaseConfig = {
    apiKey: "AIzaSyDeuXMVp1Y4Ss-Py4-qeTlZYqDk-s7Xg-s",
    authDomain: "cmsabsensibenar.firebaseapp.com",
    projectId: "cmsabsensibenar",
    storageBucket: "cmsabsensibenar.firebasestorage.app",
    messagingSenderId: "1005997535417",
    appId: "1:1005997535417:web:b73c7477ea5af5134d2b68",
    measurementId: "G-E9V7ZGM5FH"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const usePushNotifications = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const hasRegistered = useRef(false);

    useEffect(() => {
        if (user?.id && !hasRegistered.current) {
            registerPush();
            hasRegistered.current = true;
        }
    }, [user?.id]);

    // Helper for Web Push VAPID key
    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const registerPush = async () => {
        if (!user?.id) return;

        // --- NATIVE PLATFORM (Android/iOS) ---
        if (Capacitor.isNativePlatform()) {
            try {
                let permStatus = await PushNotifications.checkPermissions();

                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.warn('User denied native push notification permissions');
                    return;
                }

                await PushNotifications.addListener('registration', async (token) => {
                    console.log('Native Push registration success');
                    await saveTokenToDatabase(token.value, 'native');
                    localStorage.setItem('fcm_token_native', token.value);
                });

                await PushNotifications.addListener('registrationError', (error: any) => {
                    console.error('Error on registration: ' + JSON.stringify(error));
                });

                await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast({
                        title: notification.title || "Notifikasi Baru",
                        description: notification.body || "Anda menerima pesan baru.",
                    });
                });

                if (Capacitor.getPlatform() === 'android') {
                    await PushNotifications.createChannel({
                        id: 'default',
                        name: 'Default',
                        description: 'General Notifications',
                        importance: 5,
                        visibility: 1,
                        vibration: true,
                    });
                }

                await PushNotifications.register();
            } catch (error) {
                console.error('Native push registration failed', error);
            }
        }
        // --- WEB PLATFORM (PWA) ---
        else {
            try {
                console.log('Requesting notification permission...');
                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }

                if (permission !== 'granted') {
                    console.warn('User denied web push permissions');
                    return;
                }

                // Explicitly register our specific messaging service worker
                console.log('Registering messaging service worker...');
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });
                console.log('Messaging service worker registered:', registration);

                // Get FCM token using Firebase SDK
                const VAPID_PUBLIC_KEY = 'BCT-K19g5pQvHIioEfMYsz0_J1GW9KTxOsYIxWDGAr_fNfsuE3O5q5iijBHIhm1TCfpkjy-DGsaVE51OHH7Gcxo';

                console.log('Getting FCM registration token for PWA...');
                const token = await getToken(messaging, {
                    vapidKey: VAPID_PUBLIC_KEY,
                    serviceWorkerRegistration: registration
                });

                if (token) {
                    console.log('PWA token received successfully:', token);

                    // Only save and toast if the token is different from what we last saved
                    const lastToken = localStorage.getItem('fcm_token_pwa');
                    if (lastToken !== token) {
                        await saveTokenToDatabase(token, 'pwa');
                        localStorage.setItem('fcm_token_pwa', token);

                        toast({
                            title: "PWA Push Aktif",
                            description: "Perangkat ini sekarang terdaftar untuk notifikasi.",
                        });
                    }

                    // Listen for foreground messages
                    onMessage(messaging, (payload) => {
                        console.log('Foreground message received:', payload);
                        toast({
                            title: payload.notification?.title || "Notifikasi Baru",
                            description: payload.notification?.body || "Anda menerima pesan baru.",
                        });
                    });
                } else {
                    console.warn('No registration token available. Request permission to generate one.');
                }

            } catch (error) {
                console.error('Web push registration failed:', error);
            }
        }
    };

    const saveTokenToDatabase = async (tokenValue: string, platform: string) => {
        if (!user?.id) return;

        try {
            const { error } = await supabase
                .from('fcm_tokens' as any)
                .upsert({
                    user_id: user.id,
                    token: tokenValue,
                    device_type: platform,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, token' });

            if (error) console.error('Error saving push token to database:', error);
        } catch (e) {
            console.error('Exception saving push token:', e);
        }
    };

    return {
        permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
        isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream,
        isStandalone: (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches,
        register: registerPush
    };
};
