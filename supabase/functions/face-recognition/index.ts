import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get Python service URL from environment
const PYTHON_FACE_SERVICE_URL = Deno.env.get('PYTHON_FACE_SERVICE_URL') || 'http://localhost:5000'

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // Get user from JWT
        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('Unauthorized')
        }

        const { action, image, stored_encoding } = await req.json()

        if (!action || !image) {
            throw new Error('Missing required fields: action, image')
        }

        let endpoint = ''
        let payload: any = { image }

        if (action === 'enroll') {
            endpoint = '/enroll'
        } else if (action === 'verify') {
            if (!stored_encoding) {
                throw new Error('Missing stored_encoding for verification')
            }
            endpoint = '/verify'
            payload.stored_encoding = stored_encoding
        } else {
            throw new Error('Invalid action. Must be "enroll" or "verify"')
        }

        // Call Python face service
        const response = await fetch(`${PYTHON_FACE_SERVICE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        const result = await response.json()

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.ok ? 200 : response.status,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
