-- ============================================================
-- Seed data — salons de test rdvous
-- À coller dans l'éditeur SQL Supabase
--
-- Prérequis : avoir créé 3 salons de test via /admin avec
-- des noms contenant "test" (ex : "Test Manucure", "Test
-- Coiffure", "Test Toilettage"). Le script les trouve
-- automatiquement via la colonne `metier`.
--
-- Si un salon test n'est pas trouvé, un NOTICE l'indique
-- et la section est ignorée — pas d'erreur fatale.
-- ============================================================

DO $$
DECLARE
  -- ── Salon IDs ──────────────────────────────────────────
  manu_id  UUID;
  coiff_id UUID;
  toil_id  UUID;

  -- ── Prestations — Manucure ─────────────────────────────
  pm1 UUID := gen_random_uuid(); -- Pose gel complète
  pm2 UUID := gen_random_uuid(); -- Pose semi-permanent
  pm3 UUID := gen_random_uuid(); -- Dépose
  pm4 UUID := gen_random_uuid(); -- Remplissage gel
  pm5 UUID := gen_random_uuid(); -- French manucure

  -- ── Prestations — Coiffure ─────────────────────────────
  pc1 UUID := gen_random_uuid(); -- Coupe femme
  pc2 UUID := gen_random_uuid(); -- Coupe homme
  pc3 UUID := gen_random_uuid(); -- Couleur complète
  pc4 UUID := gen_random_uuid(); -- Balayage
  pc5 UUID := gen_random_uuid(); -- Brushing

  -- ── Prestations — Toilettage ───────────────────────────
  pt1 UUID := gen_random_uuid(); -- Toilettage complet petit
  pt2 UUID := gen_random_uuid(); -- Toilettage complet grand
  pt3 UUID := gen_random_uuid(); -- Bain + séchage
  pt4 UUID := gen_random_uuid(); -- Coupe ongles
  pt5 UUID := gen_random_uuid(); -- Épilation oreilles

  -- ── Clients — Manucure ─────────────────────────────────
  cm1 UUID := gen_random_uuid();
  cm2 UUID := gen_random_uuid();
  cm3 UUID := gen_random_uuid();
  cm4 UUID := gen_random_uuid();
  cm5 UUID := gen_random_uuid();

  -- ── Clients — Coiffure ─────────────────────────────────
  cc1 UUID := gen_random_uuid();
  cc2 UUID := gen_random_uuid();
  cc3 UUID := gen_random_uuid();
  cc4 UUID := gen_random_uuid();
  cc5 UUID := gen_random_uuid();

  -- ── Clients — Toilettage ───────────────────────────────
  ct1 UUID := gen_random_uuid();
  ct2 UUID := gen_random_uuid();
  ct3 UUID := gen_random_uuid();
  ct4 UUID := gen_random_uuid();
  ct5 UUID := gen_random_uuid();

  -- ── RDVs — Manucure (rm1–rm8) ──────────────────────────
  rm1 UUID := gen_random_uuid();
  rm2 UUID := gen_random_uuid();
  rm3 UUID := gen_random_uuid();
  rm4 UUID := gen_random_uuid();
  rm5 UUID := gen_random_uuid();
  rm6 UUID := gen_random_uuid();
  rm7 UUID := gen_random_uuid();
  rm8 UUID := gen_random_uuid();

  -- ── RDVs — Coiffure (rc1–rc8) ──────────────────────────
  rc1 UUID := gen_random_uuid();
  rc2 UUID := gen_random_uuid();
  rc3 UUID := gen_random_uuid();
  rc4 UUID := gen_random_uuid();
  rc5 UUID := gen_random_uuid();
  rc6 UUID := gen_random_uuid();
  rc7 UUID := gen_random_uuid();
  rc8 UUID := gen_random_uuid();

  -- ── RDVs — Toilettage (rt1–rt8) ────────────────────────
  rt1 UUID := gen_random_uuid();
  rt2 UUID := gen_random_uuid();
  rt3 UUID := gen_random_uuid();
  rt4 UUID := gen_random_uuid();
  rt5 UUID := gen_random_uuid();
  rt6 UUID := gen_random_uuid();
  rt7 UUID := gen_random_uuid();
  rt8 UUID := gen_random_uuid();

BEGIN

  -- ──────────────────────────────────────────────────────
  -- 0. Résolution des salons de test
  --    Le script cherche un salon dont le nom contient
  --    "test" (insensible à la casse) pour chaque métier.
  -- ──────────────────────────────────────────────────────
  SELECT id INTO manu_id  FROM salons WHERE metier = 'manucure'   AND nom ILIKE '%test%' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO coiff_id FROM salons WHERE metier = 'coiffure'   AND nom ILIKE '%test%' ORDER BY created_at DESC LIMIT 1;
  SELECT id INTO toil_id  FROM salons WHERE metier = 'toilettage' AND nom ILIKE '%test%' ORDER BY created_at DESC LIMIT 1;

  IF manu_id  IS NULL THEN RAISE NOTICE 'Salon manucure test introuvable — section ignorée'; END IF;
  IF coiff_id IS NULL THEN RAISE NOTICE 'Salon coiffure test introuvable — section ignorée'; END IF;
  IF toil_id  IS NULL THEN RAISE NOTICE 'Salon toilettage test introuvable — section ignorée'; END IF;

  -- ══════════════════════════════════════════════════════
  -- 1. MANUCURE
  -- ══════════════════════════════════════════════════════
  IF manu_id IS NOT NULL THEN

    INSERT INTO prestations (id, salon_id, nom, duree_minutes, tarif) VALUES
      (pm1, manu_id, 'Pose gel complète',   90, 45),
      (pm2, manu_id, 'Pose semi-permanent', 60, 35),
      (pm3, manu_id, 'Dépose',              30, 15),
      (pm4, manu_id, 'Remplissage gel',     60, 30),
      (pm5, manu_id, 'French manucure',     75, 40);

    INSERT INTO clients (id, salon_id, prenom, nom, telephone, email, date_naissance,
                         code_parrainage, champs_metier, nb_visites, cagnotte) VALUES
      (cm1, manu_id, 'Sophie',  'Martin',  '0712345678', 'sophie.martin@gmail.com',
       '1990-03-15', 'Sophie15', '{"mesures_capsules": "4.5 / 5 / 5.5 / 5 / 4.5"}', 2, 0),
      (cm2, manu_id, 'Camille', 'Dupont',  '0623456789', 'camille.dupont@gmail.com',
       '1985-07-22', 'Camille22', '{"mesures_capsules": "5 / 5.5 / 6 / 5.5 / 5"}',   1, 10),
      (cm3, manu_id, 'Julie',   'Bernard', '0634567890', 'julie.bernard@gmail.com',
       '1995-11-08', 'Julie08', '{"mesures_capsules": "4 / 4.5 / 5 / 4.5 / 4"}',   1, 0),
      (cm4, manu_id, 'Léa',     'Moreau',  '0745678901', 'lea.moreau@gmail.com',
       '1992-04-30', 'Lea30', '{}',                                               0, 0),
      (cm5, manu_id, 'Emma',    'Petit',   '0656789012', 'emma.petit@gmail.com',
       '1988-09-14', 'Emma14', '{"mesures_capsules": "5.5 / 6 / 6.5 / 6 / 5.5"}', 1, 5);

    -- passés (terminés) + aujourd'hui + futurs
    INSERT INTO rendez_vous (id, salon_id, client_id, date_heure, statut, montant_cagnotte_utilise) VALUES
      (rm1, manu_id, cm1, '2026-04-08 10:00:00', 'termine',  0),
      (rm2, manu_id, cm2, '2026-04-15 14:30:00', 'termine',  0),
      (rm3, manu_id, cm5, '2026-04-22 11:00:00', 'termine',  5),
      (rm4, manu_id, cm1, '2026-05-06 09:30:00', 'termine',  0),
      (rm5, manu_id, cm3, '2026-05-13 15:00:00', 'termine',  0),
      (rm6, manu_id, cm2, '2026-05-19 10:00:00', 'confirme', 0),
      (rm7, manu_id, cm4, '2026-05-23 14:00:00', 'confirme', 0),
      (rm8, manu_id, cm1, '2026-05-28 11:30:00', 'confirme', 0);

    INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id) VALUES
      (rm1, pm1), (rm1, pm3),  -- pose gel + dépose
      (rm2, pm2),              -- semi-permanent
      (rm3, pm5),              -- french
      (rm4, pm4),              -- remplissage
      (rm5, pm2), (rm5, pm3),  -- semi-permanent + dépose
      (rm6, pm1),              -- aujourd'hui : pose gel
      (rm7, pm2),              -- futur : semi-permanent
      (rm8, pm4), (rm8, pm3);  -- futur : remplissage + dépose

  END IF;


  -- ══════════════════════════════════════════════════════
  -- 2. COIFFURE
  -- ══════════════════════════════════════════════════════
  IF coiff_id IS NOT NULL THEN

    INSERT INTO prestations (id, salon_id, nom, duree_minutes, tarif) VALUES
      (pc1, coiff_id, 'Coupe femme',      45,  40),
      (pc2, coiff_id, 'Coupe homme',      30,  25),
      (pc3, coiff_id, 'Couleur complète', 120, 80),
      (pc4, coiff_id, 'Balayage',         150, 95),
      (pc5, coiff_id, 'Brushing',          30, 25);

    INSERT INTO clients (id, salon_id, prenom, nom, telephone, email, date_naissance,
                         code_parrainage, champs_metier, nb_visites, cagnotte) VALUES
      (cc1, coiff_id, 'Marie',    'Leroy',    '0698765432', 'marie.leroy@gmail.com',
       '1987-06-12', 'Marie12',
       '{"type_cheveux": "fins et lisses",   "couleur_actuelle": "châtain clair"}',  1, 0),
      (cc2, coiff_id, 'Alice',    'Dubois',   '0687654321', 'alice.dubois@gmail.com',
       '1993-02-28', 'Alice28',
       '{"type_cheveux": "bouclés épais",    "couleur_actuelle": "blond vénitien"}', 1, 0),
      (cc3, coiff_id, 'Nathalie', 'Simon',    '0676543210', 'nathalie.simon@gmail.com',
       '1979-10-05', 'Nathalie05',
       '{"type_cheveux": "normaux",          "couleur_actuelle": "brun naturel"}',   2, 15),
      (cc4, coiff_id, 'Clara',    'Fontaine', '0765432109', 'clara.fontaine@gmail.com',
       '1998-08-19', 'Clara19',
       '{"type_cheveux": "ondulés secs",     "couleur_actuelle": "rouge acajou"}',   0, 0),
      (cc5, coiff_id, 'Lucie',    'Garnier',  '0754321098', 'lucie.garnier@gmail.com',
       '1991-12-03', 'Lucie03',
       '{"type_cheveux": "fins et fragiles", "couleur_actuelle": "noir naturel"}',   1, 0);

    INSERT INTO rendez_vous (id, salon_id, client_id, date_heure, statut, montant_cagnotte_utilise) VALUES
      (rc1, coiff_id, cc3, '2026-04-10 09:00:00', 'termine',  0),
      (rc2, coiff_id, cc1, '2026-04-24 11:00:00', 'termine',  0),
      (rc3, coiff_id, cc2, '2026-05-02 14:00:00', 'termine',  0),
      (rc4, coiff_id, cc3, '2026-05-08 10:30:00', 'termine',  0),
      (rc5, coiff_id, cc5, '2026-05-14 15:30:00', 'termine',  0),
      (rc6, coiff_id, cc1, '2026-05-19 11:00:00', 'confirme', 0),
      (rc7, coiff_id, cc4, '2026-05-26 14:30:00', 'confirme', 0),
      (rc8, coiff_id, cc2, '2026-06-03 10:00:00', 'confirme', 0);

    INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id) VALUES
      (rc1, pc3),              -- couleur complète
      (rc2, pc1), (rc2, pc5),  -- coupe + brushing
      (rc3, pc4),              -- balayage
      (rc4, pc1),              -- coupe femme
      (rc5, pc5),              -- brushing
      (rc6, pc3), (rc6, pc1),  -- aujourd'hui : couleur + coupe
      (rc7, pc4),              -- futur : balayage
      (rc8, pc1), (rc8, pc5);  -- futur : coupe + brushing

  END IF;


  -- ══════════════════════════════════════════════════════
  -- 3. TOILETTAGE
  -- ══════════════════════════════════════════════════════
  IF toil_id IS NOT NULL THEN

    INSERT INTO prestations (id, salon_id, nom, duree_minutes, tarif) VALUES
      (pt1, toil_id, 'Toilettage complet (petit)', 60, 45),
      (pt2, toil_id, 'Toilettage complet (grand)',  90, 65),
      (pt3, toil_id, 'Bain + séchage',              45, 30),
      (pt4, toil_id, 'Coupe ongles',                15, 10),
      (pt5, toil_id, 'Épilation oreilles',           10,  8);

    INSERT INTO clients (id, salon_id, prenom, nom, telephone, email, date_naissance,
                         code_parrainage, champs_metier, nb_visites, cagnotte) VALUES
      (ct1, toil_id, 'Maxime',  'Renaud',  '0611223344', 'maxime.renaud@gmail.com',
       '1986-04-20', 'Maxime20',
       '{"race": "Golden Retriever", "age": "3 ans", "poids": "32 kg",  "comportement": "calme"}',   1, 0),
      (ct2, toil_id, 'Isabelle','Moreau',  '0622334455', 'isabelle.moreau@gmail.com',
       '1980-11-15', 'Isabelle15',
       '{"race": "Bichon frisé",    "age": "5 ans", "poids": "4 kg",   "comportement": "anxieux"}',  1, 0),
      (ct3, toil_id, 'Thomas',  'Lambert', '0633445566', 'thomas.lambert@gmail.com',
       '1995-07-09', 'Thomas09',
       '{"race": "Labrador",        "age": "2 ans", "poids": "28 kg",  "comportement": "joueur"}',   2, 10),
      (ct4, toil_id, 'Chloé',   'Vincent', '0644556677', 'chloe.vincent@gmail.com',
       '1990-02-14', 'Chloe14',
       '{"race": "Persan",          "age": "4 ans", "poids": "4.5 kg", "comportement": "docile"}',   0, 0),
      (ct5, toil_id, 'Antoine', 'Blanc',   '0655667788', 'antoine.blanc@gmail.com',
       '1983-09-30', 'Antoine30',
       '{"race": "Berger allemand", "age": "6 ans", "poids": "35 kg",  "comportement": "méfiant"}',  1, 0);

    INSERT INTO rendez_vous (id, salon_id, client_id, date_heure, statut, montant_cagnotte_utilise) VALUES
      (rt1, toil_id, ct3, '2026-04-05 09:30:00', 'termine',  0),
      (rt2, toil_id, ct1, '2026-04-19 14:00:00', 'termine',  0),
      (rt3, toil_id, ct2, '2026-05-04 10:30:00', 'termine',  0),
      (rt4, toil_id, ct3, '2026-05-11 09:00:00', 'termine',  0),
      (rt5, toil_id, ct5, '2026-05-16 15:00:00', 'termine',  0),
      (rt6, toil_id, ct1, '2026-05-19 09:30:00', 'confirme', 0),
      (rt7, toil_id, ct4, '2026-05-27 11:00:00', 'confirme', 0),
      (rt8, toil_id, ct2, '2026-06-02 14:30:00', 'confirme', 0);

    INSERT INTO rendez_vous_prestations (rendez_vous_id, prestation_id) VALUES
      (rt1, pt2),              -- toilettage grand
      (rt2, pt1), (rt2, pt4),  -- toilettage petit + ongles
      (rt3, pt1), (rt3, pt5),  -- toilettage petit + oreilles
      (rt4, pt2), (rt4, pt4),  -- toilettage grand + ongles
      (rt5, pt3),              -- bain seul
      (rt6, pt2), (rt6, pt4),  -- aujourd'hui : toilettage grand + ongles
      (rt7, pt1),              -- futur : toilettage petit
      (rt8, pt3), (rt8, pt5);  -- futur : bain + oreilles

  END IF;

END $$;
