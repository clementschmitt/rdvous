-- Email du compte sur l'appareil.
-- Le rattachement d'une cliente à ses rendez-vous se fait par l'email
-- (voir /api/mon-compte), or `auth.users` n'est pas interrogeable par email
-- depuis une route serveur sans parcourir tous les comptes. On dénormalise donc
-- l'email ici pour retrouver les appareils d'une cliente en une seule requête.
-- `user_id` reste la référence qui fait foi et la clé de suppression en cascade.

alter table appareils add column if not exists email text;

create index if not exists idx_appareils_email on appareils (lower(email));
