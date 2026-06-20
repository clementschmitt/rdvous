CREATE TABLE IF NOT EXISTS avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID REFERENCES salons(id) ON DELETE CASCADE,
  rdv_id UUID REFERENCES rendez_vous(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  note INTEGER CHECK (note >= 1 AND note <= 5),
  commentaire TEXT,
  statut TEXT NOT NULL DEFAULT 'visible',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS avis_rdv_id_idx ON avis(rdv_id);

ALTER TABLE rendez_vous ADD COLUMN IF NOT EXISTS avis_demande_le TIMESTAMPTZ;

ALTER TABLE avis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon can read own avis" ON avis FOR SELECT
  USING (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()));

CREATE POLICY "Salon can update own avis" ON avis FOR UPDATE
  USING (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()));
