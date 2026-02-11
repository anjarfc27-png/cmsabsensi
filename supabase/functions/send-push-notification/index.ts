import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get OAuth2 access token from Service Account using Web Crypto
async function getAccessToken(serviceAccount: any): Promise<string> {
    const encoder = new TextEncoder();

    const jwtHeader = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = btoa(JSON.stringify(jwtHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(jwtClaimSet)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const incompleteToken = `${encodedHeader}.${encodedPayload}`;

    // Import the private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = serviceAccount.private_key
        .replace(pemHeader, "")
        .replace(pemFooter, "")
        .replace(/\s/g, "");

    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        encoder.encode(incompleteToken)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const jwt = `${incompleteToken}.${encodedSignature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const data = await response.json();
    if (!data.access_token) {
        console.error('OAuth error response:', data);
        throw new Error('Failed to obtain access token: ' + (data.error_description || data.error));
    }
    return data.access_token;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()
        console.log('Received notification payload:', JSON.stringify(payload));

        // Handle both direct calls and Supabase Webhook format
        let userId, title, body, data, topic;

        if (payload.record) {
            // This is a Supabase Webhook (INSERT/UPDATE)
            userId = payload.record.user_id;
            title = payload.record.title;
            body = payload.record.message;
            data = {
                type: payload.record.type,
                link: payload.record.link,
                notification_id: payload.record.id
            };
        } else {
            // This is a direct call from frontend
            userId = payload.userId;
            title = payload.title;
            body = payload.body;
            data = payload.data;
            topic = payload.topic;
        }

        // Get Firebase Service Account from environment
        const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
        if (!serviceAccountJson) {
            console.error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
            return new Response(
                JSON.stringify({ error: 'System configuration error: Firebase credentials missing' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountJson)
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
            return new Response(
                JSON.stringify({ error: 'System configuration error: Invalid Firebase credentials format' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        const projectId = serviceAccount.project_id

        // Get OAuth2 access token
        const accessToken = await getAccessToken(serviceAccount)

        // 1. Send via TOPIC (Broadcast)
        if (topic) {
            console.log('Sending push to TOPIC:', topic);

            // Safely prepare data values as strings for FCM v1
            const fcmData: Record<string, string> = {};
            if (data) {
                Object.keys(data).forEach(key => {
                    if (data[key] !== null && data[key] !== undefined) {
                        fcmData[key] = String(data[key]);
                    }
                });
            }

            const fcmPayload = {
                message: {
                    topic: topic,
                    notification: {
                        title: title && title.startsWith('CMS |') ? title : `CMS | ${title || 'Notifikasi'}`,
                        body: body || '',
                    },
                    data: fcmData,
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channel_id: 'default',
                            icon: 'ic_notification'
                        },
                    },
                },
            }

            const response = await fetch(
                `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify(fcmPayload),
                }
            )

            const result = await response.json()
            return new Response(
                JSON.stringify({ success: true, method: 'topic', result }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Send via USER TOKENS (Direct)
        // Get Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get user's FCM tokens or ALL tokens for broadcast
        // SECURITY AUDIT: Only send to active users
        let query;

        if (userId === 'all' || userId === 'ALL' || userId === 'broadcast') {
            console.log('Broadcasting notification to all active users via tokens');
            // Inner join with profiles to filter is_active = true
            query = supabase
                .from('fcm_tokens')
                .select('token, profiles!inner(is_active)')
                .eq('profiles.is_active', true);
        } else {
            query = supabase
                .from('fcm_tokens')
                .select('token')
                .eq('user_id', userId);
        }

        const { data: tokens, error: tokenError } = await query;

        if (tokenError) {
            console.error('Error fetching FCM tokens:', tokenError)
            throw tokenError
        }

        if (!tokens || tokens.length === 0) {
            console.log('No FCM tokens found for target:', userId)
            return new Response(
                JSON.stringify({ success: false, message: 'No FCM tokens found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Safely prepare data values as strings for FCM v1
        const fcmData: Record<string, string> = {};
        if (data) {
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    fcmData[key] = String(data[key]);
                }
            });
        }

        // Send FCM notification to each token using v1 API
        const results = await Promise.all(
            tokens.map(async ({ token }) => {
                const fcmPayload = {
                    message: {
                        token: token,
                        notification: {
                            title: title && title.startsWith('CMS |') ? title : `CMS | ${title || 'Notifikasi'}`,
                            body: body || '',
                        },
                        data: fcmData,
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                channel_id: 'default',
                                icon: 'ic_notification'
                            },
                        },
                        webpush: {
                            headers: {
                                Urgency: "high"
                            },
                            notification: {
                                icon: "/logo.png",
                                vibrate: [200, 100, 200],
                                requireInteraction: true,
                                actions: [
                                    {
                                        action: "open_app",
                                        title: "Buka Aplikasi"
                                    }
                                ]
                            }
                        }
                    },
                }

                const response = await fetch(
                    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify(fcmPayload),
                    }
                )

                const result = await response.json()

                // CLEANUP: If token is invalid/expired, remove it from database
                if (response.status === 404 || response.status === 410 || (result.error && result.error.status === 'UNREGISTERED')) {
                    console.log(`Token ${token.substring(0, 10)}... is invalid. Removing from database.`);
                    await supabase
                        .from('fcm_tokens')
                        .delete()
                        .eq('token', token);
                }

                return { token, result, status: response.status }
            })
        )

        console.log('FCM send results:', results)

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error in send-push-notification:', error)
        console.error('Error type:', typeof error)
        console.error('Error stringified:', JSON.stringify(error, null, 2))

        let errorMessage = 'Unknown error'
        let errorDetails: any = {}

        if (error instanceof Error) {
            errorMessage = error.message
            errorDetails = {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        } else if (typeof error === 'object' && error !== null) {
            errorMessage = JSON.stringify(error)
            errorDetails = error
        } else {
            errorMessage = String(error)
            errorDetails = { raw: String(error) }
        }

        return new Response(
            JSON.stringify({
                error: errorMessage,
                details: errorDetails,
                timestamp: new Date().toISOString()
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
