-- Migrasi Perbaikan Trigger Pendaftaran (Auto-Staff)
-- Memastikan setiap user baru otomatis mendapatkan role 'employee' di tabel profiles

-- 1. Redefinisi fungsi trigger untuk menangani user baru
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    phone, 
    nik,
    role,                 -- PASTIKAN KOLOM INI DIISI
    onboarding_status,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    -- Ambil nama dari metadata, atau fallback ke email user
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    -- Ambil data tambahan dari metadata (dikirim dari form registrasi)
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'nik',
    -- SET DEFAULT ROLE MENJADI 'employee' (STAFF)
    'employee',
    -- Set status onboarding
    'pending_verification',
    -- Default aktif
    true,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- 2. Pastikan trigger terpasang (jaga-jaga kalau belum)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Opsional: Fix user lama yang mungkin rolenya NULL (selain admin/manager yg sdh ada)
UPDATE public.profiles 
SET role = 'employee' 
WHERE role IS NULL;
