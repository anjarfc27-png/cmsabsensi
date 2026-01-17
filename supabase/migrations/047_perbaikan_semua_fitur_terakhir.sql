-- GABUNGAN MIGRASI UNTUK UPDATE TERBARU (12 JAN 2026)
-- Jalankan script ini di SQL Editor Supabase Anda untuk memperbaiki fitur Pengumuman dan Face Recognition

-- 1. Buat Table Face Enrollments (Simpel)
CREATE TABLE IF NOT EXISTS face_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    face_image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index dan RLS
CREATE INDEX IF NOT EXISTS idx_face_enrollments_user_id ON face_enrollments(user_id);
ALTER TABLE face_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop policies if exists to prevent errors
DROP POLICY IF EXISTS "Users can read own face enrollment" ON face_enrollments;
DROP POLICY IF EXISTS "Users can manage own face enrollment" ON face_enrollments;
DROP POLICY IF EXISTS "Admin HR can read all face enrollments" ON face_enrollments;

CREATE POLICY "Users can read own face enrollment" ON face_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own face enrollment" ON face_enrollments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin HR can read all face enrollments" ON face_enrollments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin_hr'));

-- 2. Buat Storage Bucket untuk Wajah
INSERT INTO storage.buckets (id, name, public) VALUES ('face-images', 'face-images', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own face image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own face image" ON storage.objects;
DROP POLICY IF EXISTS "Public can view face images" ON storage.objects;

CREATE POLICY "Users can upload own face image" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'face-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own face image" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'face-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public can view face images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'face-images');

-- 3. Update Function Publikasi Pengumuman (Fix Error)
-- Drop dulu versi lama jika ada
DROP FUNCTION IF EXISTS publish_announcement;

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
    -- Insert Announcement
    INSERT INTO announcements (title, content, created_by, is_active, created_at, expires_at)
    VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
    RETURNING id INTO v_announcement_id;

    -- Bulk Insert Notifications (Jika requested)
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

GRANT EXECUTE ON FUNCTION publish_announcement TO authenticated;

-- Selesai
