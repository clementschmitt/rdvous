"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabase } from "@/lib/supabase";
import { T } from "@/lib/theme";
import { Suspense } from "react";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    (async () => {
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type") as "email" | "signup" | null;
      const next = searchParams.get("next") || "/onboarding";

      if (!token_hash || !type) { setStatus("error"); return; }

      const supabase = createSupabase();
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: type === "signup" ? "signup" : "email" });
      if (error) { setStatus("error"); return; }

      // Détermine la redirection selon le type de compte
      const { data: { user } } = await supabase.auth.getUser();
      const isClient = user?.user_metadata?.user_type === "client";
      router.replace(isClient ? "/mon-compte" : next);
    })();
  }, []);

  if (status === "error") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg }}>
      <div style={{ textAlign: "center", maxWidth: 360, padding: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Lien invalide ou expiré</div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>Ce lien de confirmation ne fonctionne plus. Créez un nouveau compte ou reconnectez-vous.</div>
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
