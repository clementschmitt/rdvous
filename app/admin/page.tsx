"use client";
import { useEffect, useState } from "react";
import { createSupabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { METIERS, type Metier } from "@/lib/metiers";
import { T } from "@/lib/theme";
import { formatPrix } from "@/lib/prix";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;

type Salon = { id: string; nom: string; metier: Metier; email: string | null; created_at: string; visible_recherche: boolean | null };
type InviteForm = { email: string; password: string; salon_id: string };
type UsersStats = { nbPro: number; nbClient: number; nbTotal: number; days: Record<string, { pro: number; client: number }> };
type PrestaImport = { nom: string; duree_minutes: number; tarif: number; sur_devis: boolean; description?: string };
type CatImport = { nom: string; prestations: PrestaImport[] };

export default function AdminPage() {
  const router = useRouter();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [usersStats, setUsersStats] = useState<UsersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOverride, setCurrentOverride] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newNom, setNewNom] = useState("");
  const [newMetier, setNewMetier] = useState<Metier>("manucure");
  const [invite, setInvite] = useState<InviteForm>({ email: "", password: "", salon_id: "" });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [impSalon, setImpSalon] = useState("");
  const [impUrl, setImpUrl] = useState("");
  const [impLoading, setImpLoading] = useState(false);
  const [impPreview, setImpPreview] = useState<CatImport[] | null>(null);
  const [impExclude, setImpExclude] = useState<Set<number>>(new Set());
  const [impMsg, setImpMsg] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email !== ADMIN_EMAIL) { router.push("/dashboard"); return; }
      await loadSalons();
      // Stats utilisateurs
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch("/api/admin/users-stats", { headers: { authorization: `Bearer ${session.access_token}` } });
        if (res.ok) setUsersStats(await res.json());
      }
      setCurrentOverride(localStorage.getItem("admin_salon_override"));
      setLoading(false);
    })();
  }, [router]);

  async function loadSalons() {
    const res = await fetch("/api/admin/salons");
    if (res.ok) {
      const data = await res.json();
      setSalons(data);
    }
  }

  function entrer(salonId: string) {
    localStorage.setItem("admin_salon_override", salonId);
    setCurrentOverride(salonId);
    router.push("/dashboard");
  }

  function sortir() {
    localStorage.removeItem("admin_salon_override");
    setCurrentOverride(null);
    router.push("/dashboard");
  }

  async function inviterUtilisateur() {
    if (!invite.email || !invite.password || !invite.salon_id) return;
    setInviting(true);
    setInviteMsg("");
    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    const json = await res.json();
    if (res.ok) {
      setInviteMsg("✓ Compte créé, l'utilisateur peut se connecter immédiatement.");
      setInvite({ email: "", password: "", salon_id: "" });
    } else {
      setInviteMsg(`Erreur : ${json.error}`);
    }
    setInviting(false);
  }

  async function previewPlanity() {
    if (!impUrl.trim()) return;
    setImpLoading(true); setImpMsg(""); setImpPreview(null);
    const res = await fetch("/api/admin/import-planity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", url: impUrl.trim() }),
    });
    const json = await res.json();
    setImpLoading(false);
    if (!res.ok) { setImpMsg(`Erreur : ${json.error}`); return; }
    setImpPreview(json.categories);
    setImpExclude(new Set());
  }

  async function importPlanity() {
    if (!impSalon || !impPreview) return;
    const categories = impPreview.filter((_, i) => !impExclude.has(i));
    if (categories.length === 0) { setImpMsg("Sélectionne au moins une catégorie."); return; }
    setImpLoading(true); setImpMsg("");
    const res = await fetch("/api/admin/import-planity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import", salon_id: impSalon, categories }),
    });
    const json = await res.json();
    setImpLoading(false);
    if (!res.ok) { setImpMsg(`Erreur : ${json.error}`); return; }
    setImpMsg(`✓ ${json.nbCat} catégories et ${json.nbPresta} prestations importées.`);
    setImpPreview(null); setImpUrl("");
  }

  async function toggleVisibilite(s: Salon) {
    const next = !(s.visible_recherche ?? false);
    await fetch("/api/admin/salon", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, visible_recherche: next }),
    });
    setSalons(prev => prev.map(x => x.id === s.id ? { ...x, visible_recherche: next } : x));
  }

  async function creerSalon() {
    if (!newNom.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/create-salon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: newNom, metier: newMetier }),
    });
    if (res.ok) {
      setNewNom("");
      await loadSalons();
    } else {
      const json = await res.json();
      alert(json.error || "Erreur lors de la création");
    }
    setCreating(false);
  }

  if (loading) return <div style={{ padding: 40, color: T.faint }}>Chargement...</div>;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, padding: 40 }}>
      <style>{`
        @media (max-width: 640px) {
          .admin-wrap { padding: 16px !important; }
          .admin-inner { padding: 16px !important; }
          .admin-row { flex-wrap: wrap !important; gap: 10px !important; }
          .admin-row-info { width: 100% !important; }
          .admin-row-actions { display: flex; gap: 8px; margin-left: 20px; }
        }
      `}</style>
      <div className="admin-wrap" style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: T.heading, fontSize: 32, fontWeight: 300, color: T.text, margin: "0 0 6px" }}>Administration</h1>
            <p style={{ ...T.ls, fontSize: "10px", color: T.muted }}>Accès réservé, {ADMIN_EMAIL}</p>
          </div>
          <a href="/admin/live" style={{ display: "flex", alignItems: "center", gap: 7, background: "#22c55e", color: "#fff", borderRadius: 20, padding: "8px 18px", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <span style={{ fontSize: 9, width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "inline-block", boxShadow: "0 0 0 3px rgba(255,255,255,0.4)", animation: "pulse 1.5s infinite" }} />
            Live
          </a>
        </div>

        {/* Stats comptes */}
        {usersStats && (() => {
          const days = Object.entries(usersStats.days);
          const maxVal = Math.max(...days.map(([, v]) => v.pro + v.client), 1);
          return (
            <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, marginBottom: 24 }}>
              <p style={{ ...T.ls, fontSize: "10px", color: T.muted, margin: "0 0 16px" }}>Comptes utilisateurs</p>
              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1, background: T.bg, borderRadius: T.radiusSm, padding: "14px 18px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: T.text }}>{usersStats.nbTotal}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Total</div>
                </div>
                <div style={{ flex: 1, background: T.bg, borderRadius: T.radiusSm, padding: "14px 18px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#7C3D8F" }}>{usersStats.nbPro}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Professionnels</div>
                </div>
                <div style={{ flex: 1, background: T.bg, borderRadius: T.radiusSm, padding: "14px 18px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#2563eb" }}>{usersStats.nbClient}</div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Clients</div>
                </div>
              </div>
              {/* Graphe 14 jours */}
              <div style={{ ...T.ls, fontSize: 10, color: T.faint, marginBottom: 8 }}>Inscriptions, 14 derniers jours</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
                {days.map(([day, v]) => {
                  const total = v.pro + v.client;
                  const h = Math.round((total / maxVal) * 60);
                  const hPro = total > 0 ? Math.round((v.pro / total) * h) : 0;
                  const hClient = h - hPro;
                  const label = new Date(day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                  return (
                    <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }} title={`${label}, ${v.pro} pro, ${v.client} client`}>
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 52 }}>
                        {hPro > 0 && <div style={{ width: "100%", height: hPro, background: "#7C3D8F", borderRadius: hClient === 0 ? "3px 3px 0 0" : "0" }} />}
                        {hClient > 0 && <div style={{ width: "100%", height: hClient, background: "#2563eb", borderRadius: hPro === 0 ? "3px 3px 0 0" : "0" }} />}
                        {total === 0 && <div style={{ width: "100%", height: 3, background: T.border, borderRadius: 3 }} />}
                      </div>
                      <div style={{ fontSize: 8, color: T.faint, marginTop: 3, whiteSpace: "nowrap" }}>{label.split(" ")[0]}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#7C3D8F" }} /><span style={{ fontSize: 10, color: T.muted }}>Pro</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#2563eb" }} /><span style={{ fontSize: 10, color: T.muted }}>Client</span></div>
              </div>
            </div>
          );
        })()}

        {currentOverride && (
          <div style={{ background: "#fff8e6", border: "1px solid #f0d080", borderRadius: T.radius, padding: "12px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#8a6200" }}>
              Mode override actif, salon : <b>{salons.find(s => s.id === currentOverride)?.nom || currentOverride}</b>
            </span>
            <button onClick={sortir} style={{ ...T.ls, fontSize: "9px", background: "#8a6200", color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "5px 12px", cursor: "pointer" }}>
              Désactiver
            </button>
          </div>
        )}

        {/* Inviter un utilisateur */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, marginBottom: 24 }}>
          <p style={{ ...T.ls, fontSize: "10px", color: T.muted, margin: "0 0 16px" }}>Inviter un utilisateur sur un salon existant</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={labelStyle}>Email</label>
              <input type="email" value={invite.email} onChange={e => setInvite(p => ({ ...p, email: e.target.value }))} placeholder="candice@exemple.fr" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 140 }}>
              <label style={labelStyle}>Mot de passe temporaire</label>
              <input type="text" value={invite.password} onChange={e => setInvite(p => ({ ...p, password: e.target.value }))} placeholder="min. 8 caractères" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={labelStyle}>Salon</label>
              <select value={invite.salon_id} onChange={e => setInvite(p => ({ ...p, salon_id: e.target.value }))} style={inputStyle}>
                <option value="">— choisir —</option>
                {salons.map(s => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
            </div>
            <button onClick={inviterUtilisateur} disabled={inviting || !invite.email || !invite.password || !invite.salon_id} style={{ ...T.ls, fontSize: "9px", background: T.text, color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "10px 16px", cursor: "pointer", opacity: inviting || !invite.email || !invite.password || !invite.salon_id ? 0.4 : 1 }}>
              {inviting ? "..." : "Inviter"}
            </button>
          </div>
          {inviteMsg && <p style={{ fontSize: 12, color: inviteMsg.startsWith("✓") ? "#16a34a" : "#B91C1C", marginTop: 10, marginBottom: 0 }}>{inviteMsg}</p>}
        </div>

        {/* Importer depuis Planity */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, marginBottom: 24 }}>
          <p style={{ ...T.ls, fontSize: "10px", color: T.muted, margin: "0 0 16px" }}>Importer un catalogue depuis Planity</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 150 }}>
              <label style={labelStyle}>Salon de destination</label>
              <select value={impSalon} onChange={e => setImpSalon(e.target.value)} style={inputStyle}>
                <option value="">— choisir —</option>
                {salons.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div style={{ flex: 3, minWidth: 220 }}>
              <label style={labelStyle}>URL publique Planity</label>
              <input value={impUrl} onChange={e => setImpUrl(e.target.value)} placeholder="https://www.planity.com/..." style={inputStyle} />
            </div>
            <button onClick={previewPlanity} disabled={impLoading || !impUrl.trim()} style={{ ...T.ls, fontSize: "9px", background: T.text, color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "10px 16px", cursor: "pointer", opacity: impLoading || !impUrl.trim() ? 0.4 : 1 }}>
              {impLoading && !impPreview ? "..." : "Prévisualiser"}
            </button>
          </div>
          {impMsg && <p style={{ fontSize: 12, color: impMsg.startsWith("✓") ? "#16a34a" : "#B91C1C", marginTop: 10, marginBottom: 0 }}>{impMsg}</p>}

          {impPreview && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>{impPreview.length} catégories détectées, décoche celles à ne pas importer.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                {impPreview.map((cat, i) => (
                  <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: T.radiusSm, padding: "10px 14px", opacity: impExclude.has(i) ? 0.45 : 1 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, color: T.text }}>
                      <input type="checkbox" checked={!impExclude.has(i)} onChange={() => setImpExclude(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
                      {cat.nom} <span style={{ color: T.muted, fontWeight: 400 }}>· {cat.prestations.length} prestation{cat.prestations.length > 1 ? "s" : ""}</span>
                    </label>
                    <div style={{ marginTop: 6, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 3 }}>
                      {cat.prestations.map((p, pi) => (
                        <div key={pi} style={{ fontSize: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ color: T.text }}>{p.nom}</span>
                            <span style={{ color: T.muted, whiteSpace: "nowrap" }}>{p.duree_minutes} min · {formatPrix(p.tarif, p.sur_devis)}</span>
                          </div>
                          {p.description && <div style={{ color: T.faint, fontSize: 11, marginTop: 1 }}>{p.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
                <button onClick={importPlanity} disabled={impLoading || !impSalon} style={{ ...T.ls, fontSize: "9px", background: "#16a34a", color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "10px 18px", cursor: "pointer", opacity: impLoading || !impSalon ? 0.4 : 1 }}>
                  {impLoading ? "Import en cours..." : "Importer dans le salon"}
                </button>
                {!impSalon && <span style={{ fontSize: 11, color: "#B91C1C" }}>Choisis un salon de destination en haut</span>}
              </div>
            </div>
          )}
        </div>

        {/* Créer un salon test */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 24, marginBottom: 24 }}>
          <p style={{ ...T.ls, fontSize: "10px", color: T.muted, margin: "0 0 16px" }}>Créer un salon de test</p>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Nom</label>
              <input value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Ex: Test Toilettage" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Métier</label>
              <select value={newMetier} onChange={e => setNewMetier(e.target.value as Metier)} style={inputStyle}>
                {(Object.keys(METIERS) as Metier[]).map(m => (
                  <option key={m} value={m}>{METIERS[m].label}</option>
                ))}
              </select>
            </div>
            <button onClick={creerSalon} disabled={creating || !newNom.trim()} style={{ ...T.ls, fontSize: "9px", background: T.text, color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "10px 16px", cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
              {creating ? "..." : "Créer"}
            </button>
          </div>
        </div>

        {/* Liste des salons */}
        <div style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
            <p style={{ ...T.ls, fontSize: "10px", color: T.muted, margin: 0 }}>{salons.length} salons en base</p>
          </div>
          {salons.map((s, i) => {
            const m = METIERS[s.metier];
            const isActive = s.id === currentOverride;
            return (
              <div key={s.id} className="admin-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", borderBottom: i < salons.length - 1 ? `1px solid ${T.border}` : "none", background: isActive ? `${m.couleur}08` : "transparent" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: m.couleur, flexShrink: 0 }} />
                <div className="admin-row-info" style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.nom}</div>
                  <div style={{ ...T.ls, fontSize: "9px", color: T.muted, marginTop: 2 }}>
                    {m.label} · {s.email || "—"} · {new Date(s.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button
                    onClick={() => toggleVisibilite(s)}
                    title={s.visible_recherche ? "Visible dans la recherche, cliquer pour masquer" : "Masqué de la recherche, cliquer pour rendre visible"}
                    style={{ ...T.ls, fontSize: "9px", border: `1px solid ${s.visible_recherche ? "#16a34a" : T.border}`, background: s.visible_recherche ? "#f0fdf4" : T.bg, color: s.visible_recherche ? "#16a34a" : T.muted, borderRadius: T.radiusSm, padding: "5px 12px", cursor: "pointer", flexShrink: 0 }}>
                    {s.visible_recherche ? "● Visible" : "○ Masqué"}
                  </button>
                  {isActive ? (
                    <span style={{ ...T.ls, fontSize: "9px", color: m.couleur, background: `${m.couleur}15`, padding: "4px 10px", borderRadius: T.radiusSm }}>Actif</span>
                  ) : (
                    <button onClick={() => entrer(s.id)} style={{ ...T.ls, fontSize: "9px", background: m.couleur, color: "#fff", border: "none", borderRadius: T.radiusSm, padding: "5px 12px", cursor: "pointer" }}>
                      Entrer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: T.radiusSm, fontSize: 13, background: T.bg, color: T.text, outline: "none" };
