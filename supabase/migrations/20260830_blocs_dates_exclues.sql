-- Occurrences supprimées d'un bloc personnel récurrent.
--
-- Une série récurrente est une seule ligne, les occurrences sont calculées à
-- l'affichage. Pour en retirer une seule, on mémorise la date écartée plutôt
-- que de matérialiser toutes les occurrences en base.
--
-- Les deux autres cas ne demandent aucune donnée nouvelle : « ce bloc et les
-- suivants » recule `recurrence_fin` à la veille, « tous les blocs » supprime
-- la ligne.

alter table agenda_evenements add column if not exists dates_exclues date[] not null default '{}';

comment on column agenda_evenements.dates_exclues is
  'Dates où cette série récurrente ne doit pas apparaître, ni bloquer la réservation publique.';
