-- ============================================================
-- NETTOYAGE RLS — supprime les anciennes politiques empilées
-- ============================================================
-- Contexte : 3 générations de politiques coexistaient. On supprime les
-- deux anciennes (rôle {public}, certaines basées sur get_my_salon_id()
-- non exécutable par anon → erreurs) pour ne garder que le jeu propre
-- owner_all / public_read / owner_self créé aujourd'hui.
-- Idempotent (drop if exists). Ne touche PAS aux politiques conservées.
-- ============================================================

-- animaux
drop policy if exists animaux_salon on animaux;

-- app_settings
drop policy if exists app_settings_insert on app_settings;
drop policy if exists app_settings_select on app_settings;
drop policy if exists app_settings_update on app_settings;
drop policy if exists settings_insert on app_settings;
drop policy if exists settings_select on app_settings;
drop policy if exists settings_update on app_settings;

-- cagnotte_mouvements
drop policy if exists cagnotte_insert on cagnotte_mouvements;
drop policy if exists cagnotte_select on cagnotte_mouvements;
drop policy if exists salon_cagnotte on cagnotte_mouvements;

-- clients
drop policy if exists clients_delete on clients;
drop policy if exists clients_insert on clients;
drop policy if exists clients_select on clients;
drop policy if exists clients_update on clients;
drop policy if exists salon_clients on clients;

-- conges
drop policy if exists conges_delete on conges;
drop policy if exists conges_insert on conges;
drop policy if exists conges_select on conges;
drop policy if exists conges_update on conges;

-- depenses
drop policy if exists depenses_rls on depenses;

-- disponibilites
drop policy if exists disponibilites_delete on disponibilites;
drop policy if exists disponibilites_insert on disponibilites;
drop policy if exists disponibilites_select on disponibilites;
drop policy if exists disponibilites_update on disponibilites;

-- disponibilites_exceptions
drop policy if exists "Owner salon" on disponibilites_exceptions;

-- prestation_categories
drop policy if exists "Owner salon" on prestation_categories;

-- prestations
drop policy if exists prestations_delete on prestations;
drop policy if exists prestations_insert on prestations;
drop policy if exists prestations_select on prestations;
drop policy if exists prestations_update on prestations;
drop policy if exists salon_prestations on prestations;

-- rendez_vous
drop policy if exists rdv_delete on rendez_vous;
drop policy if exists rdv_insert on rendez_vous;
drop policy if exists rdv_select on rendez_vous;
drop policy if exists rdv_update on rendez_vous;
drop policy if exists salon_rdv on rendez_vous;

-- rendez_vous_prestations
drop policy if exists rdv_presta_delete on rendez_vous_prestations;
drop policy if exists rdv_presta_insert on rendez_vous_prestations;
drop policy if exists rdv_presta_select on rendez_vous_prestations;
drop policy if exists salon_rdv_prestations on rendez_vous_prestations;

-- salon_users
drop policy if exists salon_users_insert on salon_users;
drop policy if exists salon_users_select on salon_users;

-- salons
drop policy if exists "Authenticated peut voir les salons visibles" on salons;
drop policy if exists "Owner peut modifier son salon" on salons;
drop policy if exists "Owner peut voir son salon" on salons;
drop policy if exists "Public peut voir les salons visibles" on salons;
drop policy if exists salon_delete on salons;
drop policy if exists salon_insert on salons;
drop policy if exists salon_select on salons;
drop policy if exists salon_update on salons;

-- vernis
drop policy if exists vernis_delete on vernis;
drop policy if exists vernis_insert on vernis;
drop policy if exists vernis_select on vernis;
drop policy if exists vernis_update on vernis;
