import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGU, rdvous",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "40px" }}>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "22px",
          fontWeight: 500,
          marginBottom: "12px",
          color: "#1a1614",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CGUPage() {
  return (
    <div style={{ background: "#faf8f5", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#1a1614" }}>
      <nav style={{ padding: "20px 24px", borderBottom: "1px solid #e8e2da" }}>
        <Link
          href="/"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "26px",
            fontWeight: 500,
            color: "#1a1614",
            textDecoration: "none",
          }}
        >
          rdvous
        </Link>
      </nav>

      <main style={{ maxWidth: "720px", margin: "0 auto", padding: "60px 24px 80px" }}>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "40px",
            fontWeight: 500,
            marginBottom: "48px",
            color: "#1a1614",
          }}
        >
          Conditions générales d'utilisation
        </h1>

        <Section title="1. Objet">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            Les présentes conditions générales d'utilisation régissent l'accès et l'utilisation de la plateforme rdvous, éditée par Clément Schmitt (SIRET 80466813500036), domicilié à Chazay-D'Azergues.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            rdvous est une plateforme de mise en relation entre des clients particuliers et des professionnels du bien-être (coiffeurs, esthéticiennes, manucures, etc.), permettant la prise de rendez-vous en ligne.
          </p>
        </Section>

        <Section title="2. Accès au service">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            L'inscription sur rdvous est gratuite pour les utilisateurs particuliers. Elle requiert la fourniture d'une adresse email valide et la création d'un mot de passe.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            L'utilisation du service est réservée aux personnes âgées d'au moins 18 ans. Les mineurs peuvent utiliser le service uniquement avec l'autorisation expresse d'un représentant légal, qui demeure responsable de l'utilisation faite du compte.
          </p>
        </Section>

        <Section title="3. Compte utilisateur">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            L'utilisateur est seul responsable de la confidentialité de ses identifiants de connexion. Toute utilisation du service effectuée depuis son compte est réputée faite par l'utilisateur lui-même.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            En cas de perte, vol ou suspicion de compromission de ses identifiants, l'utilisateur doit en informer rdvous dans les meilleurs délais à l'adresse contact@rdvous.fr afin que les mesures nécessaires puissent être prises.
          </p>
        </Section>

        <Section title="4. Utilisation du service">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            L'utilisateur s'engage à utiliser la plateforme de manière loyale et conforme à sa destination. Sont notamment interdits :
          </p>
          <ul style={{ lineHeight: "1.8", paddingLeft: "20px" }}>
            <li>La fourniture de fausses informations lors de l'inscription ou de la prise de rendez-vous</li>
            <li>L'envoi de messages non sollicités (spam) via les fonctionnalités de la plateforme</li>
            <li>Le scraping ou l'extraction automatisée de données issues de la plateforme</li>
            <li>Tout usage commercial non autorisé des contenus ou fonctionnalités de rdvous</li>
            <li>Toute tentative de contournement des mesures de sécurité ou d'accès non autorisé aux systèmes</li>
          </ul>
        </Section>

        <Section title="5. Rendez-vous">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            La prise de rendez-vous via rdvous constitue un engagement réciproque entre le client et le professionnel. Le client s'engage à se présenter à l'heure convenue ou à annuler en temps utile.
          </p>
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            L'annulation d'un rendez-vous est possible depuis l'espace personnel de l'utilisateur, dans les délais fixés par le professionnel concerné.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            Le professionnel demeure seul responsable de la qualité et de l'exécution de la prestation. rdvous intervient exclusivement en qualité d'intermédiaire technique et ne saurait être tenu responsable des manquements du professionnel dans l'exécution de sa prestation.
          </p>
        </Section>

        <Section title="6. Responsabilité">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            rdvous agit en qualité d'intermédiaire technique entre clients et professionnels. En aucun cas rdvous ne peut être considéré comme partie au contrat de prestation conclu entre le client et le professionnel.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            La disponibilité du service n'est pas garantie à 100 %. rdvous s'efforce d'assurer la continuité du service mais ne peut être tenu responsable d'interruptions liées à des opérations de maintenance, à des incidents techniques ou à tout événement indépendant de sa volonté.
          </p>
        </Section>

        <Section title="7. Propriété intellectuelle">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            L'ensemble des contenus présents sur rdvous (textes, graphismes, interface, code source) est protégé par le droit de la propriété intellectuelle et demeure la propriété exclusive de Clément Schmitt.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            La marque rdvous, son logo et tout signe distinctif associé sont réservés. Toute reproduction, représentation ou utilisation sans autorisation préalable écrite est strictement interdite.
          </p>
        </Section>

        <Section title="8. Modification des CGU">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            rdvous se réserve le droit de modifier les présentes conditions générales à tout moment. Les utilisateurs seront informés de toute modification substantielle par email à l'adresse communiquée lors de l'inscription.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            La poursuite de l'utilisation du service après notification des modifications vaut acceptation des nouvelles conditions.
          </p>
        </Section>

        <Section title="9. Droit applicable">
          <p style={{ lineHeight: "1.7" }}>
            Les présentes conditions générales d'utilisation sont soumises au droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux compétents de Lyon seront seuls habilités à connaître du différend.
          </p>
        </Section>

        <p style={{ fontSize: "13px", color: "#8a7a6a", marginBottom: "32px" }}>
          Dernière mise à jour : juin 2026
        </p>

        <Link href="/" style={{ color: "#8a7a6a", textDecoration: "none", fontSize: "14px" }}>
          ← Retour à l'accueil
        </Link>
      </main>
    </div>
  );
}
