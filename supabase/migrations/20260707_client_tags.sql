-- Tags client avec tarifs préférentiels
-- À passer dans l'éditeur SQL Supabase

-- 1. Définitions des tags par salon
CREATE TABLE IF NOT EXISTS client_tags (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  nom text NOT NULL,
  couleur text NOT NULL DEFAULT '#8b5cf6',
  auto_assign_at_visits int DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all ON client_tags;
CREATE POLICY owner_all ON client_tags FOR ALL TO authenticated
  USING (salon_id IN (SELECT current_user_salon_ids()))
  WITH CHECK (salon_id IN (SELECT current_user_salon_ids()));

-- 2. Assignation tags ↔ clients
CREATE TABLE IF NOT EXISTS client_tag_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(client_id, tag_id)
);
ALTER TABLE client_tag_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all ON client_tag_assignments;
CREATE POLICY owner_all ON client_tag_assignments FOR ALL TO authenticated
  USING (tag_id IN (SELECT id FROM client_tags WHERE salon_id IN (SELECT current_user_salon_ids())))
  WITH CHECK (tag_id IN (SELECT id FROM client_tags WHERE salon_id IN (SELECT current_user_salon_ids())));

-- 3. Tarifs préférentiels : tag + prestation → prix override
CREATE TABLE IF NOT EXISTS tag_tarifs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id uuid NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  prestation_id uuid NOT NULL REFERENCES prestations(id) ON DELETE CASCADE,
  prix_override numeric NOT NULL CHECK (prix_override >= 0),
  UNIQUE(tag_id, prestation_id)
);
ALTER TABLE tag_tarifs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all ON tag_tarifs;
CREATE POLICY owner_all ON tag_tarifs FOR ALL TO authenticated
  USING (tag_id IN (SELECT id FROM client_tags WHERE salon_id IN (SELECT current_user_salon_ids())))
  WITH CHECK (tag_id IN (SELECT id FROM client_tags WHERE salon_id IN (SELECT current_user_salon_ids())));

-- Droits de base sur les tables
GRANT ALL ON client_tags TO authenticated;
GRANT ALL ON client_tag_assignments TO authenticated;
GRANT ALL ON tag_tarifs TO authenticated;

-- Policy admin (même pattern que toutes les autres tables du projet)
DROP POLICY IF EXISTS admin_all ON client_tags;
CREATE POLICY admin_all ON client_tags FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_all ON client_tag_assignments;
CREATE POLICY admin_all ON client_tag_assignments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_all ON tag_tarifs;
CREATE POLICY admin_all ON tag_tarifs FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
