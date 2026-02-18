-- Migration: Soft delete support for announcements and automatic purge
-- Created: 2026-02-11
-- Description: Adds deleted_at column for soft delete and schedules a task to hard delete after 3 months.

-- 1. Add deleted_at column
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 2. Update RLS policies to handle deleted_at
-- Everyone can only see non-deleted active announcements
DROP POLICY IF EXISTS "Everyone can view active announcements" ON public.announcements;
CREATE POLICY "Everyone can view active announcements" ON public.announcements
    FOR SELECT USING (
        is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
        AND deleted_at IS NULL
    );

-- Admins can view everything including soft-deleted ones
DROP POLICY IF EXISTS "Admins can view all announcements" ON public.announcements;
CREATE POLICY "Admins can view all announcements" ON public.announcements
    FOR SELECT USING (
        public.has_role(auth.uid(), 'admin_hr') OR 
        public.has_role(auth.uid(), 'super_admin') 
        OR (SELECT email FROM public.profiles WHERE id = auth.uid()) LIKE '%admin%'
    );

-- 3. Function to purge announcements deleted more than 3 months ago
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_announcements() 
RETURNS void AS $$
BEGIN
    DELETE FROM public.announcements 
    WHERE deleted_at IS NOT NULL 
    AND deleted_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule the purge task using pg_cron (runs daily at midnight)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'purge_announcements_job',
            '0 0 * * *',
            'SELECT public.purge_soft_deleted_announcements()'
        );
    END IF;
END $$;

COMMENT ON COLUMN public.announcements.deleted_at IS 'Timestamp when the announcement was soft-deleted. Records are hard-deleted after 3 months.';
