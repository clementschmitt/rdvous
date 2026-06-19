"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { type Metier } from "@/lib/metiers";

export type Salon = { id: string; nom: string; metier: Metier; plan: string; sms_credits: number };

const SalonContext = createContext<Salon | null>(null);

export function SalonProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [salon, setSalon] = useState<Salon | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const override = typeof window !== "undefined" ? localStorage.getItem("admin_salon_override") : null;
      if (override) {
        const res = await fetch(`/api/admin/salon?id=${override}`);
        if (res.ok) { const s = await res.json(); setSalon(s as Salon); return; }
      }

      const { data: su } = await supabase.from("salon_users").select("salon_id").eq("user_id", user.id).single();
      if (!su) { router.push(user.user_metadata?.user_type === "client" ? "/mon-compte" : "/onboarding"); return; }
      const { data: s } = await supabase.from("salons").select("id, nom, metier, plan, sms_credits").eq("id", su.salon_id).single();
      if (s) setSalon(s as Salon);
    })();
  }, [router]);

  return <SalonContext.Provider value={salon}>{children}</SalonContext.Provider>;
}

export function useSalon() {
  return useContext(SalonContext);
}
