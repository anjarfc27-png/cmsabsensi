-- Drop existing policies for participants to be safe
DROP POLICY IF EXISTS "Manage agenda participants" ON agenda_participants;
DROP POLICY IF EXISTS "Insert agenda participants" ON agenda_participants;

-- 1. Policy for INSERT (Creating new participants)
-- Allow authenticated users to insert if they are admin/manager
CREATE POLICY "Insert agenda participants" ON agenda_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin_hr', 'manager')
  )
);

-- 2. Policy for UPDATE/DELETE
-- Allow managing existing records
CREATE POLICY "Update Delete agendaa participants" ON agenda_participants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin_hr', 'manager')
  )
);

-- 3. Policy for DELETE (Explicitly)
CREATE POLICY "Delete agenda participants" ON agenda_participants
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin_hr', 'manager')
  )
);

-- Ensure RLS is enabled
ALTER TABLE agenda_participants ENABLE ROW LEVEL SECURITY;
