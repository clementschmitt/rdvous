ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS sms_confirmation_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_rappel_active BOOLEAN DEFAULT true;
