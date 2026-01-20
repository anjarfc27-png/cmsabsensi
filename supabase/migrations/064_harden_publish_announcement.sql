-- Harden publish_announcement RPC (post-audit)

-- Restrict publishing announcements to admin_hr / manager.
-- Note: function is SECURITY DEFINER; therefore we must validate caller identity explicitly.

CREATE OR REPLACE FUNCTION public.publish_announcement(
  p_title TEXT,
  p_content TEXT,
  p_created_by UUID,
  p_send_notification BOOLEAN DEFAULT true,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_announcement_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Caller must match p_created_by
  IF auth.uid() <> p_created_by THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Only privileged roles can publish
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin_hr', 'manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1. Insert Announcement
  INSERT INTO public.announcements (title, content, created_by, is_active, created_at, expires_at)
  VALUES (p_title, p_content, p_created_by, true, NOW(), p_expires_at)
  RETURNING id INTO v_announcement_id;

  -- 2. Bulk Insert Notifications for All Active Users (if requested)
  IF p_send_notification THEN
    INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
    SELECT
      id,
      p_title,
      p_content,
      'info',
      false,
      NOW()
    FROM public.profiles
    WHERE is_active = true;
  END IF;

  RETURN v_announcement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_announcement(TEXT, TEXT, UUID, BOOLEAN, TIMESTAMPTZ) TO authenticated;
