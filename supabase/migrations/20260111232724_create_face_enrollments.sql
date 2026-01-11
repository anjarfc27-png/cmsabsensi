-- Migration: Create face_enrollments table for simple face registration
-- Created: 2026-01-11
-- Description: Simple face enrollment system using image storage (like pinjol verification)

CREATE TABLE IF NOT EXISTS face_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    face_image_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_face_enrollments_user_id ON face_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_face_enrollments_active ON face_enrollments(is_active) WHERE is_active = true;

-- Add RLS policies
ALTER TABLE face_enrollments ENABLE ROW LEVEL SECURITY;

-- Users can read their own enrollment
CREATE POLICY "Users can read own face enrollment"
ON face_enrollments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert/update their own enrollment
CREATE POLICY "Users can manage own face enrollment"
ON face_enrollments
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin HR can read all enrollments
CREATE POLICY "Admin HR can read all face enrollments"
ON face_enrollments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin_hr'
    )
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_face_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_face_enrollments_updated_at
BEFORE UPDATE ON face_enrollments
FOR EACH ROW
EXECUTE FUNCTION update_face_enrollments_updated_at();

-- Create storage bucket for face images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-images', 'face-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for face-images bucket
CREATE POLICY "Users can upload own face image"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'face-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own face image"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'face-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view face images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'face-images');

-- Helper function to check if user has face enrollment
CREATE OR REPLACE FUNCTION has_face_enrollment(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM face_enrollments
        WHERE user_id = p_user_id AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE face_enrollments IS 'Simple face enrollment system - stores face images for verification';
COMMENT ON COLUMN face_enrollments.face_image_url IS 'URL to stored face image in Supabase Storage';
COMMENT ON COLUMN face_enrollments.is_active IS 'Whether this enrollment is currently active';
