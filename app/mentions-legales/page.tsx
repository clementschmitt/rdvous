import Link from "next/link";

export const metadata = {
  title: "Mentions légales, rdvous",
};

export default function MentionsLegalesPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#faf8f5", fontFamily: "'Inter',system-ui,sans-serif", color: "#1a1614" }}>

      {/* NAV */}
      <nav style={{ background: "rgba(250,248,245,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(200,180,160,0.25)", padding: "0 40px", display: "flex", alignItems: "center", height: 64 }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 600, letterSpacing: "0.03em", color: "#1a1614", textDecoration: "none" }}>
          rdvous
        </Link>
      </nav>

      {/* CONTENU */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
        <Link href="/" style={{ fontSize: 13, color: "#8a7a6a", textDecoration: "none", display: "inline-block", marginBottom: 32 }}>
          ← Retour à l'accueil
        </Link>

        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 40, fontWeight: 500, margin: "0 0 48px", color: "#1a1614" }}>
          Mentions légales
        </h1>

        <Section titre="Éditeur du site">
          <p>Le site <strong>rdvous.fr</strong> est édité par :</p>
          <p>
            <strong>Clément Schmitt</strong><br />
            Auto-entrepreneur<br />
            SIRET : 80466813500036<br />
            Lyon, France<br />
            Email : <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a>
          </p>
        </Section>

        <Section titre="Directeur de la publication">
          <p>Clément Schmitt, <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a></p>
        </Section>

        <Section titre="Hébergement">
          <p>
            Le site rdvous.fr est hébergé par :<br />
            <strong>Vercel Inc.</strong><br />
            440 N Barranca Ave #4133<br />
            Covina, CA 91723, États-Unis<br />
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" style={{ color: "#8a6a3a" }}>vercel.com</a>
          </p>
        </Section>

        <Section titre="Propriété intellectuelle">
          <p>
            L'ensemble du contenu publié sur rdvous.fr (textes, visuels, interface, code) est la propriété exclusive de Clément Schmitt, sauf mention contraire.
            Toute reproduction, représentation ou diffusion, totale ou partielle, sans autorisation écrite préalable est interdite.
          </p>
        </Section>

        <Section titre="Données personnelles">
          <p>
            rdvous.fr collecte et traite des données personnelles dans le cadre de la fourniture de son service de gestion de rendez-vous.
          </p>
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD, UE 2016/679), vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données personnelles.
          </p>
          <p>
            Pour exercer ces droits ou pour toute question relative à vos données :{" "}
            <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a>
          </p>
        </Section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(200,180,160,0.3)", padding: "32px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <Link href="/" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: "#1a1614", textDecoration: "none" }}>rdvous</Link>
        <span style={{ fontSize: 12, color: "#b8a898" }}>© 2026 rdvous</span>
      </footer>

    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#8a6a3a", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 16px", paddingBottom: 10, borderBottom: "1px solid rgba(200,180,160,0.3)" }}>
        {titre}
      </h2>
      <div style={{ fontSize: 15, color: "#4a3a2a", lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
