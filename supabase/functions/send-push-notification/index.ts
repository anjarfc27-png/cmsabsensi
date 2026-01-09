import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { userId, title, body, data } = await req.json()

        // Get FCM Server Key from environment
        const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')
        if (!FCM_SERVER_KEY) {
            throw new Error('FCM_SERVER_KEY not configured')
        }

        // Get Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Get user's FCM tokens
        const { data: tokens, error: tokenError } = await supabase
            .from('fcm_tokens')
            .select('token')
            .eq('user_id', userId)

        if (tokenError) {
            console.error('Error fetching FCM tokens:', tokenError)
            throw tokenError
        }

        if (!tokens || tokens.length === 0) {
            console.log('No FCM tokens found for user:', userId)
            return new Response(
                JSON.stringify({ success: false, message: 'No FCM tokens found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send FCM notification to each token
        const results = await Promise.all(
            tokens.map(async ({ token }) => {
                const fcmPayload = {
                    to: token,
                    notification: {
                        title: title,
                        body: body,
                        sound: 'default',
                        badge: '1',
                    },
                    data: data || {},
                    priority: 'high',
                }

                const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `key=${FCM_SERVER_KEY}`,
                    },
                    body: JSON.stringify(fcmPayload),
                })

                const result = await response.json()
                return { token, result }
            })
        )

        console.log('FCM send results:', results)

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        console.error('Error in send-push-notification:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
