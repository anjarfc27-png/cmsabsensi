-- 110_push_notif_panggilan.sql
-- Goal: Mengirim Push Notification FCM saat ada panggilan masuk

CREATE OR REPLACE FUNCTION public.notify_on_new_call_push()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_name TEXT;
    v_fcm_token TEXT;
BEGIN
    -- 1. Hanya proses jika statusnya 'ringing'
    IF NEW.status = 'ringing' THEN
        -- 2. Ambil nama penelepon
        SELECT full_name INTO v_caller_name FROM public.profiles WHERE id = NEW.caller_id;
        
        -- 3. Masukkan ke tabel notifications agar trigger push existing berjalan
        -- Type 'call' bisa diproses khusus oleh frontend nantinya
        INSERT INTO public.notifications (
            user_id, 
            title, 
            message, 
            type, 
            extra_data
        )
        VALUES (
            NEW.receiver_id,
            '📞 Panggilan Masuk',
            'Telepon dari ' || coalesce(v_caller_name, 'Seseorang'),
            'system',
            jsonb_build_object(
                'call_id', NEW.id,
                'signaling_id', NEW.signaling_id,
                'type', 'incoming_call'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger saat insert panggilan baru
DROP TRIGGER IF EXISTS tr_on_new_call_push ON public.calls;
CREATE TRIGGER tr_on_new_call_push
    AFTER INSERT ON public.calls
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_new_call_push();

COMMENT ON FUNCTION public.notify_on_new_call_push IS 'Mengirim push notification otomatis saat ada panggilan masuk baru.';
