CREATE TABLE IF NOT EXISTS depenses_fixes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  montant NUMERIC(10,2) NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE depenses_fixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "depenses_fixes_salon" ON depenses_fixes
  FOR ALL
  USING (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()))
  WITH CHECK (salon_id IN (SELECT salon_id FROM salon_users WHERE user_id = auth.uid()));
CREATE POLICY "depenses_fixes_admin" ON depenses_fixes FOR ALL USING (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON depenses_fixes TO authenticated;
GRANT ALL ON depenses_fixes TO service_role;
