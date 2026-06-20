"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";
import { Suspense } from "react";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const next = searchParams.get("next") || "/onboarding";
    const supabase = createSupabase();

    // Le client Supabase traite automatiquement le #access_token du fragment
    // On écoute le changement de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const isClient = session.user?.user_metadata?.user_type === "client";
        setStatus("success");
        setTimeout(() => router.replace(isClient ? "/mon-compte" : next), 1500);
      }
    });

    // Cas où la session est déjà établie avant l'écoute
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        const isClient = session.user?.user_metadata?.user_type === "client";
        setStatus("success");
        setTimeout(() => router.replace(isClient ? "/mon-compte" : next), 1500);
      }
    });

    // Timeout si rien ne se passe après 8s
    const timeout = setTimeout(() => setStatus("error"), 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (status === "success") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ textAlign: "center", maxWidth: 380, padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 10 }}>Email confirmé !</div>
        <div style={{ fontSize: 14, color: T.muted }}>Votre compte est activé. Redirection en cours…</div>
      </div>
    </div>
  );

  if (status === "error") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Lien invalide ou expiré</div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>Ce lien ne fonctionne plus. Créez un nouveau compte ou reconnectez-vous.</div>
        <a href="/login" style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>Retour à la connexion</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ textAlign: "center", color: T.muted, fontSize: 14 }}>Vérification en cours…</div>
    </div>
  );
}

export default function ConfirmPage() {
  return <Suspense><ConfirmContent /></Suspense>;
}
