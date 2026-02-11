-- Ensure fcm_tokens table exists in the new project
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own tokens
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.fcm_tokens;
CREATE POLICY "Users can manage their own tokens" ON public.fcm_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Allow service role to read all tokens (for Edge Function)
DROP POLICY IF EXISTS "Service role can read all tokens" ON public.fcm_tokens;
CREATE POLICY "Service role can read all tokens" ON public.fcm_tokens
    FOR SELECT USING (true);

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_fcm_tokens_updated_at ON public.fcm_tokens;
CREATE TRIGGER tr_fcm_tokens_updated_at
    BEFORE UPDATE ON public.fcm_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_fcm_tokens_updated_at();

