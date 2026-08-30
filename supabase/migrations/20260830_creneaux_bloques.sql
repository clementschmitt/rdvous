-- Verrou temporaire sur un créneau pendant que la cliente saisit ses coordonnées.
-- Sans lui, deux clientes peuvent viser le même horaire et la seconde n'apprend
-- qu'il est pris qu'au moment de valider, après avoir tout rempli.

create table if not exists creneaux_bloques (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  -- Sans fuseau, comme rendez_vous.date_heure : tout le code lit l heure en
  -- decoupant la chaine, un timestamptz decalerait les creneaux de deux heures.
  date_heure timestamp not null,
  duree_minutes integer not null,
  -- Identifiant de session généré par le navigateur, pas de compte requis :
  -- la réservation publique se fait sans authentification.
  cle_session text not null,
  expire_le timestamptz not null,
  created_at timestamptz not null default now()
);

-- Les lectures filtrent toujours sur le salon et sur les verrous encore vivants.
create index if not exists idx_creneaux_bloques_salon_expire on creneaux_bloques (salon_id, expire_le);
-- La libération et le rafraîchissement passent par la clé de session.
create index if not exists idx_creneaux_bloques_session on creneaux_bloques (cle_session);

alter table creneaux_bloques enable row level security;

-- Aucune policy pour anon : la table n'est touchée que par les routes API en
-- service_role. On ajoute l'override admin pour rester cohérent avec les autres
-- tables, sinon /admin "Entrer" ne verrait rien.
drop policy if exists admin_all on creneaux_bloques;
create policy admin_all on creneaux_bloques for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists owner_read on creneaux_bloques;
create policy owner_read on creneaux_bloques for select to authenticated
  using (salon_id in (select current_user_salon_ids()));

-- Droits de table. Sans eux Postgres répond "permission denied" avant même
-- d'évaluer la RLS, y compris pour service_role, et l'API du verrou échoue.
-- anon n'est pas listé volontairement : la table n'est jamais lue directement
-- depuis le navigateur, tout passe par les routes serveur.
grant all on table creneaux_bloques to service_role;
grant select on table creneaux_bloques to authenticated;
