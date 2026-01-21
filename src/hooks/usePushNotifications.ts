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
        if (Capacitor.isNativePlatform() && user?.id) {
            registerPush();
        }
    }, [user?.id]);

    const registerPush = async () => {
        try {
            // Check performance
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('User denied push notification permissions');
                return;
            }

            // REGISTER LISTENERS BEFORE CALLING REGISTER()
            // This prevents race conditions where the event fires before the listener is attached

            // On success, we get a token
            await PushNotifications.addListener('registration', async (token) => {
                console.log('Push registration success');

                // Save token to Supabase
                const { error } = await supabase
                    .from('fcm_tokens' as any)
                    .upsert({
                        user_id: user?.id,
                        token: token.value,
                        device_type: Capacitor.getPlatform(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id, token' });

                if (error) console.error('Error saving FCM token:', error);

                // Subscribe to 'all_employees' topic by default for broadcasts
                // Note: This requires the client-side topic subscription method or native implementation
                // Alternatively, we handle topic logic purely server-side by querying 'all' tokens.
                // But for FCM Topics to work natively, we can use the backend to subscribe this token to a topic.
                try {
                    // We will use our own Edge Function to subscribe this new token to a topic silently
                    if (user?.id) {
                        // Optional: You could call an edge function here to subscribe `token.value` to 'all_employees'
                        // But for now, our Edge Function 'send-push-notification' handles broadcast by iterating tokens (userId='all')
                        // which is safer if we don't want to manage topic subscriptions complexity on client.

                        // HOWEVER, if Dashboard uses `topic: 'all_employees'`, efficient broadcasting demands real FCM topics.
                        // Let's rely on the iterating tokens method for now as it's more robust without extra client setup.
                    }
                } catch (e) {
                    console.warn('Failed to subscribe to topic', e);
                }
            });

            await PushNotifications.addListener('registrationError', (error: any) => {
                console.error('Error on registration: ' + JSON.stringify(error));
            });

            await PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push received: ', notification);

                // Show in-app toast if foreground
                toast({
                    title: notification.title || "Notifikasi Baru",
                    description: notification.body || "Anda menerima pesan baru.",
                    variant: "default",
                });
            });

            await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push action performed: ', notification);
                // Handle navigation if link is provided in data
                const link = notification.notification.data?.link;
                if (link) {
                    console.log('Should navigate to:', link);
                    // In a real app, you'd use a global navigation emitter or similar
                    // For now, we just log it.
                }
            });

            // Create notification channel for Android (High Importance)
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

            // NOW call register
            await PushNotifications.register();

        } catch (error) {
            console.error('Push notification registration failed', error);
        }
    };
};
