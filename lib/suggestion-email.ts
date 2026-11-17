// Propose une correction quand le domaine d'un email ressemble à un fournisseur courant sans l'être
// (« @mail.com » pour « @gmail.com », « @hotmial.fr », « @gmail.con »). Un contrôle de format ne
// suffit pas : ces adresses sont bien formées, parfois même réelles, mais ce ne sont pas celles de
// la cliente. La suggestion ne bloque jamais la saisie, la cliente reste libre de garder la sienne.

const DOMAINES_COURANTS = [
  "gmail.com", "hotmail.fr", "hotmail.com", "outlook.fr", "outlook.com", "live.fr", "live.com",
  "yahoo.fr", "yahoo.com", "icloud.com", "me.com", "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr",
  "laposte.net", "neuf.fr", "bbox.fr", "aol.com", "msn.com", "protonmail.com", "proton.me",
];

// Distance d'édition avec les inversions de deux lettres voisines (« gmial » compte pour une faute).
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Renvoie l'adresse corrigée à proposer, ou null si rien ne cloche.
export function suggererEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 1) return null;
  const local = v.slice(0, at);
  const domaine = v.slice(at + 1);
  if (!domaine.includes(".") || DOMAINES_COURANTS.includes(domaine)) return null;

  let meilleur: string | null = null;
  let meilleureDistance = 3;
  for (const d of DOMAINES_COURANTS) {
    const dist = distance(domaine, d);
    if (dist < meilleureDistance) { meilleur = d; meilleureDistance = dist; }
  }
  // Au-delà de deux fautes, c'est probablement un vrai domaine (professionnel, associatif) : on se tait.
  return meilleur ? `${local}@${meilleur}` : null;
}
