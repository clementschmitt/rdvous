-- Liste d'attente : une cliente laisse ses coordonnées pour un jour donné.
-- Quand un RDV est annulé ce jour-là, elle est notifiée automatiquement.
create table if not exists liste_attente (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salons(id) on delete cascade,
  prenom text not null,
  nom text not null,
  email text not null,
  telephone text not null,
  prestation_ids uuid[] not null default '{}',
  date_souhaitee date not null,
  statut text not null default 'en_attente', -- en_attente | notifie | converti | expire | annule
  notifie_le timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_liste_attente_salon_date
  on liste_attente (salon_id, date_souhaitee, statut);
