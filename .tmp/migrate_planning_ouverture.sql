ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS planning_ouverture_mode TEXT NOT NULL DEFAULT 'horizon',
  ADD COLUMN IF NOT EXISTS planning_ouverture_jour INTEGER NOT NULL DEFAULT 23;
