-- Description optionnelle par prestation (affichée sur la page publique de réservation)
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS description text;
