-- ============================================================
-- SÉCURISATION RLS — rdvous
-- ============================================================
-- Objectif : fermer l'accès direct à la base via la clé anon publique.
-- Modèle :
--   * service_role (routes API, pages serveur) : ignore RLS, accès total.
--   * authenticated propriétaire : accès aux lignes de SON salon via salon_users.
--   * authenticated cliente finale : aucun accès direct (tout passe par l'API).
--   * anon (visiteur) : lecture des salons publics uniquement (annuaire).
--
-- Idempotent : peut être relancé sans risque (drop policy if exists).
-- Rollback par table en bas du fichier.
-- ============================================================

-- Fonction helper : salons possédés par l'utilisateur connecté.
-- SECURITY DEFINER pour ignorer la RLS de salon_users (évite toute récursion).
create or replace function public.current_user_salon_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select salon_id from salon_users where user_id = auth.uid()
$$;

grant execute on function public.current_user_salon_ids() to authenticated;

-- ============================================================
-- 1. Tables avec colonne salon_id directe → politique propriétaire
-- ============================================================

-- animaux
alter table animaux enable row level security;
drop policy if exists owner_all on animaux;
create policy owner_all on animaux for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- app_settings
alter table app_settings enable row level security;
drop policy if exists owner_all on app_settings;
create policy owner_all on app_settings for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- cagnotte_mouvements
alter table cagnotte_mouvements enable row level security;
drop policy if exists owner_all on cagnotte_mouvements;
create policy owner_all on cagnotte_mouvements for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- clients
alter table clients enable row level security;
drop policy if exists owner_all on clients;
create policy owner_all on clients for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- conges
alter table conges enable row level security;
drop policy if exists owner_all on conges;
create policy owner_all on conges for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- depenses
alter table depenses enable row level security;
drop policy if exists owner_all on depenses;
create policy owner_all on depenses for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- disponibilites
alter table disponibilites enable row level security;
drop policy if exists owner_all on disponibilites;
create policy owner_all on disponibilites for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- disponibilites_exceptions
alter table disponibilites_exceptions enable row level security;
drop policy if exists owner_all on disponibilites_exceptions;
create policy owner_all on disponibilites_exceptions for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- liste_attente
alter table liste_attente enable row level security;
drop policy if exists owner_all on liste_attente;
create policy owner_all on liste_attente for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- prestation_categories
alter table prestation_categories enable row level security;
drop policy if exists owner_all on prestation_categories;
create policy owner_all on prestation_categories for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- prestations
alter table prestations enable row level security;
drop policy if exists owner_all on prestations;
create policy owner_all on prestations for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- rendez_vous
alter table rendez_vous enable row level security;
drop policy if exists owner_all on rendez_vous;
create policy owner_all on rendez_vous for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- vernis (legacy Onyxia, sécurisé par cohérence)
alter table vernis enable row level security;
drop policy if exists owner_all on vernis;
create policy owner_all on vernis for all to authenticated
  using (salon_id in (select current_user_salon_ids()))
  with check (salon_id in (select current_user_salon_ids()));

-- ============================================================
-- 2. salons : lecture publique (annuaire) + accès propriétaire
-- ============================================================
alter table salons enable row level security;

drop policy if exists public_read on salons;
create policy public_read on salons for select to anon, authenticated
  using (visible_recherche = true);

drop policy if exists owner_all on salons;
create policy owner_all on salons for all to authenticated
  using (id in (select current_user_salon_ids()))
  with check (id in (select current_user_salon_ids()));

-- ============================================================
-- 3. salon_users : chacun voit son propre lien
-- ============================================================
alter table salon_users enable row level security;
drop policy if exists owner_self on salon_users;
create policy owner_self on salon_users for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 4. rendez_vous_prestations : jonction, scope via le RDV parent
-- ============================================================
alter table rendez_vous_prestations enable row level security;
drop policy if exists owner_all on rendez_vous_prestations;
create policy owner_all on rendez_vous_prestations for all to authenticated
  using (rendez_vous_id in (select id from rendez_vous where salon_id in (select current_user_salon_ids())))
  with check (rendez_vous_id in (select id from rendez_vous where salon_id in (select current_user_salon_ids())));

-- ============================================================
-- ROLLBACK (à exécuter ligne par ligne en cas de problème)
-- ============================================================
-- alter table animaux disable row level security;
-- alter table app_settings disable row level security;
-- alter table cagnotte_mouvements disable row level security;
-- alter table clients disable row level security;
-- alter table conges disable row level security;
-- alter table depenses disable row level security;
-- alter table disponibilites disable row level security;
-- alter table disponibilites_exceptions disable row level security;
-- alter table liste_attente disable row level security;
-- alter table prestation_categories disable row level security;
-- alter table prestations disable row level security;
-- alter table rendez_vous disable row level security;
-- alter table vernis disable row level security;
-- alter table salons disable row level security;
-- alter table salon_users disable row level security;
-- alter table rendez_vous_prestations disable row level security;
