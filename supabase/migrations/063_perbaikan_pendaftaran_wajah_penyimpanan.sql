-- Fix face enrollment schema + storage buckets/policies (generated as post-audit normalization)

-- 1) Normalize face_enrollments columns (keep backward compatibility)
ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS face_image_url TEXT;

ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;

ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMPTZ;

ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

ALTER TABLE public.face_enrollments
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

-- Ensure defaults where possible
ALTER TABLE public.face_enrollments
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE public.face_enrollments
  ALTER COLUMN enrolled_at SET DEFAULT now();

ALTER TABLE public.face_enrollments
  ALTER COLUMN enrollment_date SET DEFAULT now();

ALTER TABLE public.face_enrollments
  ALTER COLUMN updated_at SET DEFAULT now();

-- 2) Ensure RLS enabled
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

-- 3) Recreate/ensure minimal policies exist (idempotent drops)
DROP POLICY IF EXISTS "Users can view own face enrollment" ON public.face_enrollments;
CREATE POLICY "Users can view own face enrollment" ON public.face_enrollments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own face enrollment" ON public.face_enrollments;
CREATE POLICY "Users can insert own face enrollment" ON public.face_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own face enrollment" ON public.face_enrollments;
CREATE POLICY "Users can update own face enrollment" ON public.face_enrollments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage all face enrollments" ON public.face_enrollments;
CREATE POLICY "Admin can manage all face enrollments" ON public.face_enrollments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin_hr', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin_hr', 'manager')
    )
  );

-- 4) Harden has_face_enrollment so users can't probe other users
CREATE OR REPLACE FUNCTION public.has_face_enrollment(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() <> p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin_hr', 'manager')
    ) THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.face_enrollments
    WHERE user_id = p_user_id
      AND is_active = true
      AND (face_descriptor IS NOT NULL OR face_image_url IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_face_enrollment(UUID) TO authenticated;

-- 5) Ensure storage buckets exist (aligned with frontend usage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-enrollments', 'face-enrollments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('reimbursements', 'reimbursements', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-attachments', 'leave-attachments', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('correction-proofs', 'correction-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 6) Storage policies (idempotent)
-- Public read for these buckets (keeps current getPublicUrl() behavior)
DROP POLICY IF EXISTS "Public read face-enrollments" ON storage.objects;
CREATE POLICY "Public read face-enrollments" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'face-enrollments');

DROP POLICY IF EXISTS "Public read attendance-photos" ON storage.objects;
CREATE POLICY "Public read attendance-photos" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public read reimbursements" ON storage.objects;
CREATE POLICY "Public read reimbursements" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'reimbursements');

DROP POLICY IF EXISTS "Public read leave-attachments" ON storage.objects;
CREATE POLICY "Public read leave-attachments" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'leave-attachments');

DROP POLICY IF EXISTS "Public read correction-proofs" ON storage.objects;
CREATE POLICY "Public read correction-proofs" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'correction-proofs');

-- Authenticated uploads: require first folder segment = auth.uid()
DROP POLICY IF EXISTS "Auth upload face-enrollments" ON storage.objects;
CREATE POLICY "Auth upload face-enrollments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'face-enrollments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth upload attendance-photos" ON storage.objects;
CREATE POLICY "Auth upload attendance-photos" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth upload avatars" ON storage.objects;
CREATE POLICY "Auth upload avatars" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth upload reimbursements" ON storage.objects;
CREATE POLICY "Auth upload reimbursements" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reimbursements'
    AND auth.uid() = owner
  );

DROP POLICY IF EXISTS "Auth upload leave-attachments" ON storage.objects;
CREATE POLICY "Auth upload leave-attachments" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'leave-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth upload correction-proofs" ON storage.objects;
CREATE POLICY "Auth upload correction-proofs" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'correction-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
