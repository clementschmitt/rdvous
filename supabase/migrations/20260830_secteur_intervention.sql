-- Zone d'intervention des salons qui se déplacent.
-- Un salon en "domicile uniquement" n'a ni adresse ni ville à renseigner, il
-- n'avait donc aucun moyen d'indiquer où il intervient, ni sur sa fiche ni sur
-- l'accueil. Texte libre volontairement : "Ouest lyonnais", "Lyon et 20 km
-- alentour", "Monts d'Or" ne rentrent dans aucune liste fermée.

alter table salons add column if not exists secteur text;

comment on column salons.secteur is
  'Zone d''intervention affichée pour les salons qui se déplacent. Texte libre, purement descriptif, non utilisé par la recherche.';
