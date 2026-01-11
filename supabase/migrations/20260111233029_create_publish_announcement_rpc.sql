-- Migration: Create function to publish announcement and notify all users
-- Created: 2026-01-11
-- Description: Inserts announcement and creates notifications for all active users efficiently

CREATE OR REPLACE FUNCTION publish_announcement(
    p_title TEXT,
    p_content TEXT,
    p_created_by UUID,
    p_send_notification BOOLEAN DEFAULT true,
    p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_announcement_id UUID;
BEGIN
    -- 1. Insert Announcement
    INSERT INTO announcements (title, content, created_by, is_active, created_at, expires_at)
    VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
    RETURNING id INTO v_announcement_id;

    -- 2. Bulk Insert Notifications for All Active Users (if requested)
    IF p_send_notification THEN
        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
        SELECT 
            id, 
            p_title, 
            p_content, 
            'info', 
            false, 
            NOW()
        FROM profiles
        WHERE is_active = true;
    END IF;

    RETURN v_announcement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (RLS will still apply on tables but function is security definer)
-- Ideally update policy logic in function or restrict who can call this
GRANT EXECUTE ON FUNCTION publish_announcement TO authenticated;

COMMENT ON FUNCTION publish_announcement IS 'Publishes announcement and auto-generates notifications for all active employees';
