-- RDVs supplémentaires — salon Test Manucure
-- Ajoute des RDVs sur juin/juillet 2026 pour les clients existants

DO $$
DECLARE
  manu_id UUID;
  cm1 UUID; cm2 UUID; cm3 UUID; cm4 UUID; cm5 UUID;
  pm1 UUID; pm2 UUID; pm3 UUID; pm4 UUID; pm5 UUID;
BEGIN
  -- Résolution salon
  SELECT id INTO manu_id FROM salons WHERE metier = 'manucure' AND nom ILIKE '%test%' ORDER BY created_at DESC LIMIT 1;
  IF manu_id IS NULL THEN RAISE EXCEPTION 'Salon manucure test introuvable'; END IF;

  -- Résolution clients existants
  SELECT id INTO cm1 FROM clients WHERE salon_id = manu_id AND prenom = 'Sophie'  AND nom = 'Martin'  LIMIT 1;
  SELECT id INTO cm2 FROM clients WHERE salon_id = manu_id AND prenom = 'Camille' AND nom = 'Dupont'  LIMIT 1;
  SELECT id INTO cm3 FROM clients WHERE salon_id = manu_id AND prenom = 'Julie'   AND nom = 'Bernard' LIMIT 1;
  SELECT id INTO cm4 FROM clients WHERE salon_id = manu_id AND prenom = 'Léa'     AND nom = 'Moreau'  LIMIT 1;
  SELECT id INTO cm5 FROM clients WHERE salon_id = manu_id AND prenom = 'Emma'    AND nom = 'Petit'   LIMIT 1;

  -- Résolution prestations existantes
  SELECT id INTO pm1 FROM prestations WHERE salon_id = manu_id AND nom = 'Pose gel complète'   LIMIT 1;
  SELECT id INTO pm2 FROM prestations WHERE salon_id = manu_id AND nom = 'Pose semi-permanent' LIMIT 1;
  SELECT id INTO pm3 FROM prestations WHERE salon_id = manu_id AND nom = 'Dépose'              LIMIT 1;
  SELECT id INTO pm4 FROM prestations WHERE salon_id = manu_id AND nom = 'Remplissage gel'     LIMIT 1;
  SELECT id INTO pm5 FROM prestations WHERE salon_id = manu_id AND nom = 'French manucure'     LIMIT 1;

  -- Nouveaux RDVs juin/juillet 2026
  INSERT INTO rendez_vous (id, salon_id, client_id, date_heure, statut, montant_cagnotte_utilise) VALUES
    -- Aujourd'hui (15 juin)
    (gen_random_uuid(), manu_id, cm1, '2026-06-15 09:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm3, '2026-06-15 11:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm5, '2026-06-15 14:30:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm2, '2026-06-15 17:00:00', 'confirme', 0),
    -- Cette semaine
    (gen_random_uuid(), manu_id, cm4, '2026-06-16 10:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm2, '2026-06-17 14:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm1, '2026-06-18 09:30:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm3, '2026-06-19 15:00:00', 'confirme', 0),
    -- Semaine prochaine
    (gen_random_uuid(), manu_id, cm5, '2026-06-22 10:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm1, '2026-06-23 14:30:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm4, '2026-06-24 11:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm2, '2026-06-25 09:00:00', 'confirme', 0),
    -- Fin juin
    (gen_random_uuid(), manu_id, cm3, '2026-06-28 14:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm5, '2026-06-30 10:30:00', 'confirme', 0),
    -- Juillet
    (gen_random_uuid(), manu_id, cm1, '2026-07-02 09:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm4, '2026-07-03 14:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm2, '2026-07-07 11:00:00', 'confirme', 0),
    (gen_random_uuid(), manu_id, cm3, '2026-07-09 15:30:00', 'confirme', 0),
    -- Passés récents (terminés, pour le CA)
    (gen_random_uuid(), manu_id, cm1, '2026-06-02 09:00:00', 'termine', 0),
    (gen_random_uuid(), manu_id, cm2, '2026-06-04 14:00:00', 'termine', 0),
    (gen_random_uuid(), manu_id, cm5, '2026-06-06 11:00:00', 'termine', 0),
    (gen_random_uuid(), manu_id, cm3, '2026-06-09 10:00:00', 'termine', 0),
    (gen_random_uuid(), manu_id, cm4, '2026-06-11 14:30:00', 'termine', 0),
    (gen_random_uuid(), manu_id, cm1, '2026-06-12 09:00:00', 'termine', 0);

  -- Prestations pour les nouveaux RDVs
  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm1 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-15' AND r.client_id = cm1
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm2 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-15' AND r.client_id = cm2
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm5 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-15' AND r.client_id = cm3
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm4 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-15' AND r.client_id = cm4
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm2 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-15' AND r.client_id = cm5
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  -- Prestations pour les terminés récents
  INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id)
  SELECT r.id, pm1 FROM rendez_vous r
  WHERE r.salon_id = manu_id AND r.date_heure >= '2026-06-02' AND r.date_heure < '2026-06-15'
  AND NOT EXISTS (SELECT 1 FROM rendez_vous_prestations rp WHERE rp.rendez_vous_id = r.id);

  RAISE NOTICE 'RDVs supplémentaires insérés avec succès.';
END $$;
