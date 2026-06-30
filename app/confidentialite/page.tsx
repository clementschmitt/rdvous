import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité — rdvous",
};

export default function ConfidentialitePage() {
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
          Politique de confidentialité
        </h1>

        <Section titre="Responsable du traitement">
          <p>
            <strong>Clément Schmitt</strong><br />
            Auto-entrepreneur<br />
            Chazay-D'Azergues, France<br />
            SIRET : 80466813500036<br />
            Email : <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a><br />
            Site : <a href="https://rdvous.fr" style={{ color: "#8a6a3a" }}>rdvous.fr</a>
          </p>
        </Section>

        <Section titre="Données collectées et finalités">
          <p>rdvous collecte uniquement les données nécessaires au fonctionnement du service de gestion de rendez-vous.</p>
          <p>
            <strong>Clients :</strong> adresse email, prénom, historique de rendez-vous, favoris.<br />
            Ces données permettent la création de compte, la prise de rendez-vous et le suivi de l'activité.
          </p>
          <p>
            <strong>Professionnels :</strong> adresse email, prénom et nom, nom du salon, SIRET, coordonnées bancaires (gérées exclusivement via Stripe).<br />
            Ces données permettent la création et la gestion du compte professionnel, ainsi que le traitement des paiements.
          </p>
        </Section>

        <Section titre="Base légale">
          <p>
            Les traitements de données réalisés par rdvous reposent sur l'exécution du contrat auquel l'utilisateur est partie (art. 6.1.b du RGPD — Règlement UE 2016/679).
          </p>
          <p>
            En créant un compte et en utilisant le service, l'utilisateur accepte que ses données soient traitées dans le cadre de la relation contractuelle établie avec rdvous.
          </p>
        </Section>

        <Section titre="Durée de conservation">
          <p>
            Les données sont conservées pendant toute la durée d'activité du compte. Après suppression du compte, les données sont conservées pendant une durée de 3 ans pour répondre aux obligations légales applicables.
          </p>
          <p>
            Passé ce délai, les données sont supprimées de manière définitive.
          </p>
        </Section>

        <Section titre="Sous-traitants et transferts hors UE">
          <p>rdvous fait appel aux sous-traitants suivants pour assurer le fonctionnement du service :</p>
          <p>
            <strong>Supabase Inc.</strong> (États-Unis) — base de données et authentification. Les données sont stockées sur une infrastructure AWS localisée en Europe (région EU).
          </p>
          <p>
            <strong>Brevo SAS</strong> (France, Paris) — envoi d'emails transactionnels (confirmations de rendez-vous, rappels, réinitialisation de mot de passe).
          </p>
          <p>
            <strong>Stripe Inc.</strong> (États-Unis / Irlande) — traitement sécurisé des paiements. Les coordonnées bancaires ne transitent jamais par les serveurs de rdvous.
          </p>
          <p>
            <strong>Vercel Inc.</strong> (États-Unis) — hébergement de l'application. Des serveurs localisés en Europe sont disponibles et utilisés prioritairement.
          </p>
          <p>
            Les transferts vers des entités établies hors de l'Union européenne s'effectuent dans le cadre de garanties appropriées (clauses contractuelles types de la Commission européenne).
          </p>
        </Section>

        <Section titre="Droits des utilisateurs">
          <p>
            Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles : accès, rectification, suppression, portabilité, limitation du traitement et opposition.
          </p>
          <p>
            Pour exercer l'un de ces droits, adressez votre demande par email à{" "}
            <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a>.
            Une réponse vous sera apportée dans un délai de 30 jours.
          </p>
        </Section>

        <Section titre="Cookies">
          <p>
            rdvous utilise uniquement des cookies techniques strictement nécessaires au fonctionnement du service, notamment le cookie de session Supabase permettant de maintenir l'authentification de l'utilisateur.
          </p>
          <p>
            Aucun cookie publicitaire, de profilage ou de suivi analytique n'est déposé.
          </p>
          <p>
            Les polices de caractères utilisées sur le site sont chargées via Google Fonts. Ce chargement entraîne un transfert de votre adresse IP vers les serveurs de Google Inc. (États-Unis).
          </p>
        </Section>

        <Section titre="Contact et réclamations">
          <p>
            Pour toute question relative à cette politique ou à vos données personnelles, contactez-nous à{" "}
            <a href="mailto:contact@rdvous.fr" style={{ color: "#8a6a3a" }}>contact@rdvous.fr</a>.
          </p>
          <p>
            Si vous estimez que le traitement de vos données n'est pas conforme à la réglementation, vous pouvez introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL) :{" "}
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: "#8a6a3a" }}>www.cnil.fr</a>.
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
      <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 500, color: "#1a1614", margin: "0 0 16px", paddingBottom: 10, borderBottom: "1px solid rgba(200,180,160,0.3)" }}>
        {titre}
      </h2>
      <div style={{ fontSize: 15, color: "#4a3a2a", lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
