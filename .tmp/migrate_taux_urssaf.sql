-- Ajoute le taux URSSAF personnalisable par salon (en pourcentage, défaut 22)
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS taux_urssaf numeric NOT NULL DEFAULT 22;
