"use client";
import { useState } from "react";
import { useSalon } from "@/lib/salon-context";
import { createSupabase } from "@/lib/supabase";

export default function SmsCreditsBanner() {
  const salon = useSalon();
  const [loading, setLoading] = useState(false);

  if (!salon || salon.plan === "free") return null;
  const credits = salon.sms_credits ?? 0;
  if (credits > 10) return null;

  const isZero = credits === 0;

  async function recharge() {
    setLoading(true);
    const supabase = createSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/sms-credits", {
      method: "POST",
      headers: { authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ salon_id: salon!.id, pack: 100 }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  return (
    <div style={{ background: isZero ? "#fef2f2" : "#fff7ed", borderBottom: `1px solid ${isZero ? "#fca5a5" : "#fed7aa"}`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: isZero ? "#dc2626" : "#c2410c", fontWeight: 600 }}>
        {isZero ? "SMS désactivés — crédits épuisés" : `Il vous reste ${credits} SMS — rechargez bientôt`}
      </span>
      <button onClick={recharge} disabled={loading}
        style={{ padding: "6px 14px", background: isZero ? "#dc2626" : "#ea580c", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
        {loading ? "…" : "Recharger"}
      </button>
    </div>
  );
}
