"use client";
import { useState, useEffect } from "react";
import { useSalon } from "@/lib/salon-context";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UpgradeBanner() {
  const salon = useSalon();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Auto-checkout si l'utilisateur vient de la landing avec ?plan=solo
  useEffect(() => {
    if (!salon) return;
    const intent = sessionStorage.getItem("upgrade_intent");
    if (intent === "solo" && salon.plan === "free") {
      sessionStorage.removeItem("upgrade_intent");
      triggerCheckout();
    }
  }, [salon]);

  async function triggerCheckout() {
    setLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ interval: "monthly", salon_id: salon!.id }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  if (!salon || salon.plan === "solo" || salon.plan === "team" || dismissed) return null;

  return (
    <div style={{ background: "#1a1614", color: "#fff", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 13 }}>
      <span style={{ opacity: 0.85 }}>
        ✨ Plan Gratuit — limité à 30 RDV/mois · Fidélité et cagnotte non disponibles
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={triggerCheckout} disabled={loading}
          style={{ padding: "6px 16px", background: "#c9a060", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          {loading ? "Chargement…" : "Passer à l'offre Indépendant — 19€/mois →"}
        </button>
        <button onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1 }}>
          ✕
        </button>
      </div>
    </div>
  );
}
