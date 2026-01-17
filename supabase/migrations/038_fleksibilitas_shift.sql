-- Add tolerance and advance clock-in settings to shifts table
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS tolerance_minutes INTEGER DEFAULT 15;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_advance_minutes INTEGER DEFAULT 30;

-- Also update work_schedules if they are still used (legacy or fallback)
ALTER TABLE public.work_schedules ADD COLUMN IF NOT EXISTS clock_in_advance_minutes INTEGER DEFAULT 30;
