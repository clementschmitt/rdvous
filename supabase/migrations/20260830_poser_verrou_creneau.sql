-- Pose atomique d'un verrou de créneau.
--
-- La première version vérifiait puis insérait depuis la route API. Sous
-- affluence, trois clientes ont obtenu un verrou sur le même créneau à quatorze
-- millisecondes d'intervalle : les trois requêtes avaient lu la table avant
-- qu'aucune n'écrive. Même schéma que `create_rdv_safe`, on sérialise par salon
-- avec un verrou consultatif tenu jusqu'à la fin de la transaction.
--
-- Retourne la date d'expiration, ou lève CONFLIT_VERROU si le créneau est déjà
-- tenu par quelqu'un d'autre, CONFLIT_CRENEAU s'il vient d'être réservé.

create or replace function poser_verrou_creneau(
  p_salon_id uuid,
  p_date_heure timestamp,
  p_duree_minutes integer,
  p_cle_session text,
  p_minutes integer default 10
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin timestamp := p_date_heure + make_interval(mins => p_duree_minutes);
  v_expire timestamptz := now() + make_interval(mins => p_minutes);
begin
  -- Sérialise les poses concurrentes sur un même salon.
  perform pg_advisory_xact_lock(hashtext(p_salon_id::text));

  -- Purge opportuniste, évite un cron pour une table qui reste minuscule.
  delete from creneaux_bloques where expire_le < now();

  -- Une session ne tient qu'un verrou : changer de créneau libère le précédent.
  -- C'est aussi ce qui permet à l'appel périodique de prolonger le verrou en
  -- place tant que la cliente est sur le formulaire.
  delete from creneaux_bloques where cle_session = p_cle_session;

  if exists (
    select 1 from creneaux_bloques
    where salon_id = p_salon_id
      and expire_le >= now()
      and cle_session <> p_cle_session
      and date_heure < v_fin
      and date_heure + make_interval(mins => duree_minutes) > p_date_heure
  ) then
    raise exception 'CONFLIT_VERROU';
  end if;

  -- Le créneau a-t-il été réservé entre temps ? Un verrou ne doit jamais laisser
  -- croire qu'un horaire déjà pris est encore disponible.
  if exists (
    select 1 from rendez_vous rv
    where rv.salon_id = p_salon_id
      and rv.statut <> 'annule'
      and rv.date_heure < v_fin
      and rv.date_heure + make_interval(mins => coalesce(rv.duree_minutes, 60)) > p_date_heure
  ) then
    raise exception 'CONFLIT_CRENEAU';
  end if;

  insert into creneaux_bloques (salon_id, date_heure, duree_minutes, cle_session, expire_le)
  values (p_salon_id, p_date_heure, p_duree_minutes, p_cle_session, v_expire);

  return v_expire;
end;
$$;

grant execute on function poser_verrou_creneau(uuid, timestamp, integer, text, integer) to service_role;
