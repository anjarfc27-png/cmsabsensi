-- Sync Profiles.role with User_Roles
-- This ensures that when an Admin changes the role in the Profile UI (which updates profiles table), 
-- the actual permissions (stored in user_roles table) are also updated automatically.

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- If role column changed
    IF (OLD.role IS DISTINCT FROM NEW.role) AND NEW.role IS NOT NULL THEN
        -- Delete existing roles for this user (assuming single role system per app logic)
        DELETE FROM public.user_roles WHERE user_id = NEW.id;
        
        -- Insert new role
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, NEW.role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS tr_sync_profile_role ON public.profiles;
CREATE TRIGGER tr_sync_profile_role
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_role_to_user_roles();

-- One-time sync for existing data to be sure
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles p
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
