-- Jetons de notification push des appareils.
-- Une cliente peut avoir plusieurs appareils, et un même appareil peut changer
-- de compte, d'où la clé d'unicité sur le jeton et non sur l'utilisateur.

create table if not exists appareils (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Jeton FCM côté Android, APNs côté iOS. Renouvelé par le système, il faut
  -- donc pouvoir le réenregistrer sans créer de doublon.
  token text not null unique,
  plateforme text not null check (plateforme in ('android', 'ios', 'web')),
  derniere_maj timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_appareils_user on appareils (user_id);

alter table appareils enable row level security;

-- Une utilisatrice ne voit et ne supprime que ses propres appareils. L'écriture
-- passe par une route serveur, elle n'est pas ouverte au navigateur.
drop policy if exists proprietaire on appareils;
create policy proprietaire on appareils for select to authenticated
  using (user_id = auth.uid());

drop policy if exists proprietaire_suppression on appareils;
create policy proprietaire_suppression on appareils for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists admin_all on appareils;
create policy admin_all on appareils for all to authenticated
  using (is_admin()) with check (is_admin());

-- Sans ces droits Postgres répond "permission denied" avant même d'évaluer la
-- RLS, y compris pour service_role.
grant all on table appareils to service_role;
grant select, delete on table appareils to authenticated;
