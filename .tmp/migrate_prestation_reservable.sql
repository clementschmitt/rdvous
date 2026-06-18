-- Prestation réservable en ligne ou non.
--   true  → visible sur la vitrine ET sélectionnable dans le tunnel de réservation (défaut)
--   false → visible sur la vitrine, mais NON réservable en ligne (sur devis / sur demande / à voir en salon)
ALTER TABLE prestations
  ADD COLUMN IF NOT EXISTS reservable boolean NOT NULL DEFAULT true;
