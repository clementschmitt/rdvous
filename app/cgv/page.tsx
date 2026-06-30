import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CGV — rdvous",
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

export default function CGVPage() {
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
          Conditions générales de vente
        </h1>

        <Section title="1. Objet">
          <p style={{ lineHeight: "1.7" }}>
            Les présentes conditions générales de vente régissent les abonnements payants proposés par rdvous aux professionnels du bien-être souhaitant utiliser la plateforme pour gérer leurs agendas et leurs rendez-vous. Ces CGV sont conclues entre Clément Schmitt (SIRET 80466813500036), domicilié à Chazay-D'Azergues, et tout professionnel s'abonnant à l'un des plans payants de rdvous.
          </p>
        </Section>

        <Section title="2. Offres et tarifs">
          <p style={{ lineHeight: "1.7", marginBottom: "16px" }}>
            rdvous propose les offres suivantes :
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid #e8e2da", borderRadius: "8px", padding: "16px 20px" }}>
              <p style={{ fontWeight: 600, marginBottom: "6px" }}>Free — 0 €/mois</p>
              <p style={{ lineHeight: "1.7", color: "#4a3f35" }}>1 agenda, jusqu'à 50 rendez-vous par mois.</p>
            </div>
            <div style={{ border: "1px solid #e8e2da", borderRadius: "8px", padding: "16px 20px" }}>
              <p style={{ fontWeight: 600, marginBottom: "6px" }}>Solo — 29 € HT/mois</p>
              <p style={{ lineHeight: "1.7", color: "#4a3f35" }}>Agendas illimités, rendez-vous illimités, rappels SMS inclus.</p>
            </div>
            <div style={{ border: "1px solid #e8e2da", borderRadius: "8px", padding: "16px 20px" }}>
              <p style={{ fontWeight: 600, marginBottom: "6px" }}>Pro — 49 € HT/mois</p>
              <p style={{ lineHeight: "1.7", color: "#4a3f35" }}>Tout ce qui est inclus dans Solo, plus les statistiques avancées et le support prioritaire.</p>
            </div>
          </div>
          <p style={{ lineHeight: "1.7" }}>
            Les prix s'entendent hors taxes. La TVA applicable est celle en vigueur au jour de la facturation, conformément à la réglementation française.
          </p>
        </Section>

        <Section title="3. Commande et paiement">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            La souscription à un abonnement payant s'effectue depuis l'espace professionnel de rdvous. Le paiement est réalisé par carte bancaire via Stripe, prestataire de paiement sécurisé. Le prélèvement est effectué mensuellement à date anniversaire de la souscription.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            Une facture est générée automatiquement à chaque renouvellement et est disponible en téléchargement depuis l'espace professionnel.
          </p>
        </Section>

        <Section title="4. Rétractation">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            Les abonnements rdvous sont souscrits par des professionnels agissant dans le cadre de leur activité commerciale. À ce titre, ces derniers ne bénéficient pas du droit de rétractation de 14 jours prévu par le Code de la consommation, réservé aux consommateurs.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            Toutefois, rdvous examine au cas par cas toute demande de remboursement formulée dans les 7 jours suivant la souscription à l'adresse contact@rdvous.fr. Aucune obligation de remboursement ne peut être garantie au-delà de ce délai.
          </p>
        </Section>

        <Section title="5. Résiliation">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            Le professionnel peut résilier son abonnement à tout moment depuis son espace professionnel, sans frais ni pénalité. La résiliation prend effet à l'issue de la période d'abonnement en cours.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            Aucun remboursement du mois en cours n'est accordé en cas de résiliation en cours de période.
          </p>
        </Section>

        <Section title="6. Défaut de paiement">
          <p style={{ lineHeight: "1.7", marginBottom: "12px" }}>
            En cas d'échec du prélèvement, rdvous en informera le professionnel par email. Si la situation n'est pas régularisée dans un délai de 7 jours, le compte professionnel sera suspendu et l'accès aux fonctionnalités payantes bloqué.
          </p>
          <p style={{ lineHeight: "1.7" }}>
            Sans régularisation dans les 30 jours suivant la suspension, rdvous se réserve le droit de procéder à la suppression définitive du compte et des données associées.
          </p>
        </Section>

        <Section title="7. Modification des tarifs">
          <p style={{ lineHeight: "1.7" }}>
            rdvous se réserve le droit de modifier ses tarifs. Toute modification sera notifiée au professionnel par email avec un préavis minimum de 30 jours avant son entrée en vigueur. Si le professionnel n'accepte pas les nouveaux tarifs, il lui appartient de résilier son abonnement avant la date d'effet de la modification.
          </p>
        </Section>

        <Section title="8. Droit applicable">
          <p style={{ lineHeight: "1.7" }}>
            Les présentes conditions générales de vente sont soumises au droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux compétents de Lyon seront seuls habilités à connaître du différend.
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
