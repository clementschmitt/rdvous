-- ============================================================
-- DURCISSEMENT salons — vue publique à colonnes sûres
-- ============================================================
-- Problème : la politique public_read exposait TOUTES les colonnes des
-- salons visibles à anon (stripe_customer_id, plan, sms_credits...).
-- Solution : anon ne lit plus la table salons directement, mais une vue
-- qui n'expose que les colonnes de l'annuaire. La vue est en sécurité
-- "définisseur" (défaut), donc elle lit salons en tant que postgres et
-- contourne RLS — anon n'a besoin d'aucune politique sur la table de base.
-- ============================================================

-- 1. Retirer la lecture publique directe sur la table de base
drop policy if exists public_read on salons;

-- 2. Vue publique : uniquement les colonnes affichées dans l'annuaire,
--    et uniquement les salons visibles.
create or replace view salons_public as
  select id, nom, slug, metier, ville, code_postal, adresse, description, photos, deplacement, visible_recherche
  from salons
  where visible_recherche = true;

-- 3. Lecture de la vue pour les visiteurs (anon + connectés)
grant select on salons_public to anon, authenticated;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop view if exists salons_public;
-- create policy public_read on salons for select to anon, authenticated
--   using (visible_recherche = true);
