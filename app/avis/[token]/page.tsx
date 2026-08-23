"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function AvisPage() {
  const { token } = useParams<{ token: string }>();
  const [salonNom, setSalonNom] = useState("");
  const [deja, setDeja] = useState(false);
  const [invalide, setInvalide] = useState(false);
  const [note, setNote] = useState(0);
  const [hover, setHover] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      // Lecture via une route serveur : la clé anon n'a pas accès à la table `avis`
      // (politique RLS adossée à salon_users).
      const res = await fetch(`/api/avis?token=${encodeURIComponent(token)}`);
      setLoading(false);
      if (!res.ok) { setInvalide(true); return; }
      const data = await res.json();
      setSalonNom(data.salon_nom || "votre salon");
      if (data.deja_note) setDeja(true);
    })();
  }, [token]);

  async function submit() {
    if (!note) return;
    setSubmitting(true);
    const res = await fetch("/api/avis/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, note, commentaire }),
    });
    setSubmitting(false);
    if (res.ok) setDone(true);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#888" }}>
      Chargement…
    </div>
  );

  if (invalide) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", color: "#888" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 16 }}>Lien invalide ou expiré.</div>
      </div>
    </div>
  );

  if (deja || done) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f7f7f5" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌟</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Merci !</div>
        <div style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
          {done ? "Votre avis a bien été enregistré." : "Vous avez déjà laissé un avis."}{" "}
          Merci de faire confiance à <strong>{salonNom}</strong>.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", background: "#f7f7f5", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "40px 32px", maxWidth: 440, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{salonNom}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3 }}>Comment s'est passé votre rendez-vous ?</div>
        </div>

        {/* Étoiles */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <button key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setNote(i)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, fontSize: 40, lineHeight: 1, color: i <= (hover || note) ? "#f5a623" : "#e0e0e0", transition: "color 0.1s, transform 0.1s", transform: i <= (hover || note) ? "scale(1.15)" : "scale(1)" }}>
              ★
            </button>
          ))}
        </div>

        {/* Légende */}
        {note > 0 && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#888", marginBottom: 20, marginTop: -16 }}>
            {["", "Très déçu·e", "Déçu·e", "Correct", "Bien", "Excellent !"][note]}
          </div>
        )}

        {/* Commentaire */}
        <textarea
          value={commentaire}
          onChange={e => setCommentaire(e.target.value)}
          placeholder="Commentaire optionnel… (ce que vous avez aimé, suggestions…)"
          rows={3}
          style={{ width: "100%", padding: "10px 14px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", color: "#1a1a1a", outline: "none" }}
        />

        <button
          onClick={submit}
          disabled={!note || submitting}
          style={{ marginTop: 16, width: "100%", padding: "13px 0", background: note ? "#1a1a1a" : "#e0e0e0", color: "#fff", border: "none", borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: note ? "pointer" : "not-allowed", transition: "background 0.15s" }}>
          {submitting ? "Envoi…" : "Envoyer mon avis"}
        </button>
      </div>
    </div>
  );
}
