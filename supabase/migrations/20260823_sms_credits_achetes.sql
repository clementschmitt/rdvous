-- ============================================================
-- Séparation des crédits SMS : forfait mensuel vs crédits achetés
-- ============================================================
-- Problème : les crédits du forfait sont remis à neuf chaque mois, sans report.
-- Mais les packs SMS achetés à l'unité sont payés par le client et ne doivent
-- jamais expirer. Avec un seul compteur, la remise à zéro mensuelle détruisait
-- les crédits achetés.
--
-- Solution : deux compteurs.
--   sms_credits          = forfait du plan, remis au quota à chaque échéance
--   sms_credits_achetes  = packs payés, sans expiration
--
-- Consommation : le forfait est entamé en premier, les crédits achetés ensuite.
-- Ainsi ce que le client a payé survit le plus longtemps possible.
-- ============================================================

-- 1. Nouveau compteur
alter table salons
  add column if not exists sms_credits_achetes integer not null default 0;

-- 2. Les packs achetés alimentent désormais leur propre compteur
drop function if exists add_sms_credits(uuid, integer);

create function add_sms_credits(p_salon_id uuid, p_amount integer)
returns void
language plpgsql
as $$
begin
  update salons
  set sms_credits_achetes = coalesce(sms_credits_achetes, 0) + p_amount
  where id = p_salon_id;
end;
$$;

-- 3. Consommation : forfait d'abord, crédits achetés ensuite
drop function if exists decrement_sms_credits(uuid);

create function decrement_sms_credits(p_salon_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_forfait integer;
  v_achetes integer;
begin
  select coalesce(sms_credits, 0), coalesce(sms_credits_achetes, 0)
  into v_forfait, v_achetes
  from salons
  where id = p_salon_id
  for update;

  if not found then
    return false;
  end if;

  if v_forfait > 0 then
    update salons set sms_credits = v_forfait - 1 where id = p_salon_id;
    return true;
  end if;

  if v_achetes > 0 then
    update salons set sms_credits_achetes = v_achetes - 1 where id = p_salon_id;
    return true;
  end if;

  return false;
end;
$$;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists add_sms_credits(uuid, integer);
-- create function add_sms_credits(p_salon_id uuid, p_amount integer) returns void
-- language plpgsql as $$
-- begin
--   update salons set sms_credits = coalesce(sms_credits, 0) + p_amount where id = p_salon_id;
-- end; $$;
--
-- drop function if exists decrement_sms_credits(uuid);
-- create function decrement_sms_credits(p_salon_id uuid) returns boolean
-- language plpgsql as $$
-- declare v_credits integer;
-- begin
--   select sms_credits into v_credits from salons where id = p_salon_id for update;
--   if v_credits is null or v_credits <= 0 then return false; end if;
--   update salons set sms_credits = sms_credits - 1 where id = p_salon_id;
--   return true;
-- end; $$;
--
-- alter table salons drop column if exists sms_credits_achetes;
