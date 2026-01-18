-- Create face_enrollments table if not exists
CREATE TABLE IF NOT EXISTS public.face_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    face_descriptor JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    enrollment_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own face enrollment" ON face_enrollments;
CREATE POLICY "Users can view own face enrollment" ON face_enrollments
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own face enrollment" ON face_enrollments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own face enrollment" ON face_enrollments
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage all face enrollments" ON face_enrollments;
CREATE POLICY "Admin can manage all face enrollments" ON face_enrollments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin_hr', 'manager')
        )
    );

-- Grant permissions
GRANT ALL ON public.face_enrollments TO authenticated;
GRANT ALL ON public.face_enrollments TO service_role;

-- Create or replace RPC function to check if user has face enrollment
CREATE OR REPLACE FUNCTION public.has_face_enrollment(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.face_enrollments
        WHERE user_id = p_user_id
        AND is_active = true
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_face_enrollment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_face_enrollment(UUID) TO service_role;
