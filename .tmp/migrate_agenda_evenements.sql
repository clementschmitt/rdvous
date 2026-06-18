CREATE TABLE IF NOT EXISTS agenda_evenements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  titre           TEXT NOT NULL,
  date_heure      TIMESTAMPTZ NOT NULL,
  duree_minutes   INTEGER NOT NULL DEFAULT 60,
  notes           TEXT,
  recurrence      TEXT CHECK (recurrence IN ('hebdomadaire')),
  recurrence_fin  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agenda_evenements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_evenements_salon" ON agenda_evenements
  FOR ALL USING (
    salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid())
  );
