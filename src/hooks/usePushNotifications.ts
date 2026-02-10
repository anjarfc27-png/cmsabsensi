import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (user?.id) {
            registerPush();
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
                if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                    console.warn('Push messaging is not supported in this browser');
                    return;
                }

                const registration = await navigator.serviceWorker.ready;

                // Check current permission
                let permission = Notification.permission;
                if (permission === 'default') {
                    permission = await Notification.requestPermission();
                }

                if (permission !== 'granted') {
                    console.warn('User denied web push permissions');
                    return;
                }

                // Subscribe to push manager with the provided VAPID PUBLIC KEY
                const VAPID_PUBLIC_KEY = 'BCT-K19g5pQvHIioEfMYsz0_J1GW9KTxOsYIxWDGAr_fNfsuE3O5q5iijBHIhm1TCfpkjy-DGsaVE51OHH7Gcxo';

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });

                console.log('Web Push subscription success');
                // Save the whole subscription object as a string for web push
                await saveTokenToDatabase(JSON.stringify(subscription), 'pwa');

            } catch (error) {
                console.error('Web push registration failed', error);
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
};
