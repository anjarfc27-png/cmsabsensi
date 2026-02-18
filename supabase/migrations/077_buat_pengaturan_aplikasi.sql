-- CREATE APP SETTINGS TABLE
-- Purpose: Store global application configurations like "require_face_verification".

CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS: 
-- Read: All authenticated users (so the app knows config)
-- Write: Only Admin HR

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read app settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only HR Admin can update app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin_hr'));

-- SEED DEFAULT SETTINGS
INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('require_face_verification', 'true'::jsonb, 'Toggle whether face verification is required for attendance')
ON CONFLICT (key) DO NOTHING;
