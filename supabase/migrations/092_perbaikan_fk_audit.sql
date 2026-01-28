-- FIX AUDIT LOGS FOREIGN KEY RELATIONSHIP
-- This matches the frontend expectation: profiles:changed_by!audit_logs_changed_by_fkey
-- We need to ensure changed_by references public.profiles, NOT auth.users.

DO $$
BEGIN
    -- 1. Drop potential existing constraints
    -- Common names that Supabase/Postgres might have generated
    ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
    ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_changed_by_fkey;
    
    -- 2. Clean up any orphaned IDs (users that might have been deleted from profiles)
    -- This ensures the ADD CONSTRAINT won't fail
    UPDATE public.audit_logs 
    SET changed_by = NULL 
    WHERE changed_by IS NOT NULL 
    AND changed_by NOT IN (SELECT id FROM public.profiles);

    -- 3. Add the explicit constraint to public.profiles
    ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_changed_by_fkey
    FOREIGN KEY (changed_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing audit logs FK: %', SQLERRM;
END $$;

-- 4. Refresh Schema Cache
NOTIFY pgrst, 'reload config';
