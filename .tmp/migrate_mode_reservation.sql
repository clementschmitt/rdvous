-- Mode de réservation du salon :
--   'menu'  → toutes les prestations affichées groupées, sélection libre (défaut, type Planity)
--   'guide' → parcours guidé étape par étape (cas Candice)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS mode_reservation text NOT NULL DEFAULT 'menu';

-- Préserve le parcours guidé pour les salons qui utilisent déjà des catégories à étapes.
-- (À ajuster ensuite à la main : un salon importé depuis Planity doit rester en 'menu'.)
-- UPDATE app_settings SET mode_reservation = 'guide'
--   WHERE salon_id IN (SELECT DISTINCT salon_id FROM prestation_categories WHERE selection_type IN ('unique','multiple'));
