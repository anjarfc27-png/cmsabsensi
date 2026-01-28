-- FIX AGENDA NOTIFICATION TIMEZONE
-- User reported that agenda notifications always show "02:00" (UTC) instead of the correct Jakarta time (WIB).
-- This migration updates the 'notify_participant_on_new_agenda' trigger function to explicitly convert
-- the agenda start_time to 'Asia/Jakarta' before formatting it into the notification message.

CREATE OR REPLACE FUNCTION notify_participant_on_new_agenda()
RETURNS TRIGGER AS $$
DECLARE
    v_agenda_title TEXT;
    v_agenda_time TIMESTAMPTZ;
BEGIN
    -- Ambil detail agenda
    SELECT title, start_time INTO v_agenda_title, v_agenda_time
    FROM public.agendas
    WHERE id = NEW.agenda_id;

    -- Masukkan ke tabel notifications
    -- FIX: Convert v_agenda_time to 'Asia/Jakarta' before using to_char
    INSERT INTO public.notifications (user_id, title, message, type, link, read)
    VALUES (
        NEW.user_id,
        'Undangan Agenda Baru',
        'Anda diundang ke: ' || v_agenda_title || ' pada ' || to_char(v_agenda_time AT TIME ZONE 'Asia/Jakarta', 'DD Mon HH24:MI'),
        'agenda_invite',
        '/agenda',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
