ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS agenda_heure_debut text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS agenda_heure_fin   text NOT NULL DEFAULT '20:00';
