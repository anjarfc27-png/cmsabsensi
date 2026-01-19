-- Enable RLS
ALTER TABLE agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_participants ENABLE ROW LEVEL SECURITY;

-- Agendas Policies
-- View: All authenticated users can view agendas
CREATE POLICY "View agendas" ON agendas FOR SELECT USING (true);

-- Insert/Update/Delete: Only admin_hr can modify agendas
CREATE POLICY "Manage agendas" ON agendas FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);

-- Agenda Participants Policies
-- View: All authenticated users can view participants
CREATE POLICY "View agenda participants" ON agenda_participants FOR SELECT USING (true);

-- Manage: Only admin_hr can manage participants
CREATE POLICY "Manage agenda participants" ON agenda_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin_hr', 'manager')
  )
);
