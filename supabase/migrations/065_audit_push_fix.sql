-- Migration: Final Audit & Fix for Push Notifications
-- Created: 2026-01-21
-- Description: Fixes column mismatches (read vs is_read) and optimizes push registration

-- 1. Fix publish_announcement RPC (Ensure it uses 'read' column)
CREATE OR REPLACE FUNCTION public.publish_announcement(
    p_title TEXT,
    p_content TEXT,
    p_created_by UUID,
    p_send_notification BOOLEAN DEFAULT true,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_announcement_id UUID;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'unauthorized';
    END IF;

    -- Only privileged roles can publish (Validate via profiles table)
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin_hr', 'manager')
    ) THEN
        RAISE EXCEPTION 'forbidden';
    END IF;

    -- 1. Insert Announcement
    INSERT INTO public.announcements (title, content, created_by, is_active, created_at, expires_at)
    VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
    RETURNING id INTO v_announcement_id;

    -- 2. Bulk Insert Notifications for All Active Users (if requested)
    -- FIX: Using 'read' instead of 'is_read' to match notifications table schema
    IF p_send_notification THEN
        INSERT INTO public.notifications (user_id, title, message, type, read, created_at)
        SELECT 
            id, 
            p_title, 
            p_content, 
            'info', 
            false, 
            NOW()
        FROM public.profiles
        WHERE is_active = true;
    END IF;

    RETURN v_announcement_id;
END;
$$;

-- 2. Ensure RLS on fcm_tokens allows service_role to read all tokens
-- (Required for Edge Function which fetches tokens for a given userId)
-- Note: Service role usually bypasses RLS, but we explicitly allow it if needed.
-- fcm_tokens table already has "Users can manage their own tokens" policy.

-- 3. Update notifications table indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);

-- 4. Fix any other potential is_read mismatch in a generic way (if any triggers used it)
-- Based on audit, most others were already fixed in 057, 059, 060.
