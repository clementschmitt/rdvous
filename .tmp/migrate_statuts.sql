-- Migration statuts rendez_vous
-- confirme → planifie
-- termine  → effectue
UPDATE rendez_vous SET statut = 'planifie' WHERE statut = 'confirme';
UPDATE rendez_vous SET statut = 'effectue' WHERE statut = 'termine';
