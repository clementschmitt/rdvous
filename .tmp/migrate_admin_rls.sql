-- ─────────────────────────────────────────────────────────────
-- Accès admin global aux données des salons (pour l'override admin)
-- ─────────────────────────────────────────────────────────────
-- Problème : l'override admin (localStorage.admin_salon_override) permet de
-- VOIR n'importe quel salon, mais les lectures dashboard passent par la session
-- de l'admin, qui n'est pas salon_user du salon visité → les RLS bloquent.
-- Solution : une policy "admin_all" sur chaque table scopée salon, qui autorise
-- l'email admin à tout lire/écrire. S'ajoute aux policies existantes (owner / public).

-- Vérifie l'email admin dans le JWT. ADAPTE l'email si besoin (= ADMIN_EMAIL de ton .env).
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT coalesce((auth.jwt() ->> 'email') = 'clement.flance@gmail.com', false);
$$;

-- Applique la policy admin sur toutes les tables scopées salon.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'salons',
    'app_settings',
    'prestations',
    'prestation_categories',
    'disponibilites',
    'disponibilites_exceptions',
    'conges',
    'rendez_vous',
    'clients',
    'liste_attente'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS admin_all ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
        t
      );
    END IF;
  END LOOP;
END $$;
