-- ============================================================
-- Décompte des crédits SMS au segment et non au message
-- ============================================================
-- Brevo facture 4,5 crédits par SEGMENT. Un segment fait 160 caractères en
-- alphabet GSM-7, mais seulement 70 dès qu'un accent force l'encodage UCS-2.
-- Le gabarit de rappel d'un salon peut donc coûter 4 fois le prix supposé.
--
-- On décompte désormais autant de crédits que le message consomme de segments.
-- Le coût est ainsi borné quoi que le salon écrive, et le compteur affiché
-- dans les paramètres correspond à la réalité.
--
-- Règle tout ou rien : si le solde total ne couvre pas le message entier,
-- rien n'est consommé et l'envoi est refusé. Pas de SMS tronqué.
-- ============================================================

drop function if exists decrement_sms_credits(uuid);

create function decrement_sms_credits(p_salon_id uuid, p_amount integer default 1)
returns boolean
language plpgsql
as $$
declare
  v_forfait integer;
  v_achetes integer;
  v_montant integer;
  v_pris_forfait integer;
begin
  v_montant := greatest(coalesce(p_amount, 1), 1);

  select coalesce(sms_credits, 0), coalesce(sms_credits_achetes, 0)
  into v_forfait, v_achetes
  from salons
  where id = p_salon_id
  for update;

  if not found then
    return false;
  end if;

  if v_forfait + v_achetes < v_montant then
    return false;
  end if;

  -- Le forfait du mois est entamé en premier : il expire de toute façon à
  -- l'échéance, alors que les crédits achetés n'expirent jamais.
  v_pris_forfait := least(v_forfait, v_montant);

  update salons
  set sms_credits = v_forfait - v_pris_forfait,
      sms_credits_achetes = v_achetes - (v_montant - v_pris_forfait)
  where id = p_salon_id;

  return true;
end;
$$;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- drop function if exists decrement_sms_credits(uuid, integer);
-- create function decrement_sms_credits(p_salon_id uuid) returns boolean
-- language plpgsql as $$
-- declare v_forfait integer; v_achetes integer;
-- begin
--   select coalesce(sms_credits,0), coalesce(sms_credits_achetes,0)
--   into v_forfait, v_achetes from salons where id = p_salon_id for update;
--   if not found then return false; end if;
--   if v_forfait > 0 then update salons set sms_credits = v_forfait - 1 where id = p_salon_id; return true; end if;
--   if v_achetes > 0 then update salons set sms_credits_achetes = v_achetes - 1 where id = p_salon_id; return true; end if;
--   return false;
-- end; $$;
