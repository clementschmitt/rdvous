// Format d'affichage du prix d'une prestation, cohérent partout :
//  - prix fixe          → "45 €"
//  - sur devis + tarif  → "à partir de 45 €"
//  - sur devis sans tarif → "Sur devis"
export function formatPrix(tarif: number, sur_devis?: boolean): string {
  if (!sur_devis) return `${tarif} €`;
  if (tarif > 0) return `à partir de ${tarif} €`;
  return "Sur devis";
}
