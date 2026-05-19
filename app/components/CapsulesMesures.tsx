"use client";

const DOIGTS = ["Pouce", "Index", "Majeur", "Annulaire", "Auriculaire"];

export type Capsules = { g: number[]; d: number[] };

export function parseCapsules(raw: unknown): Capsules {
  if (raw && typeof raw === "object" && "g" in raw && "d" in raw) {
    return raw as Capsules;
  }
  if (typeof raw === "string" && raw) {
    const match = raw.match(/G:\s*([\d\s/?]+)\s*[—\-]+\s*D:\s*([\d\s/?]+)/i);
    if (match) {
      const parse = (s: string) => s.split("/").map(v => parseInt(v.trim()) || 0).slice(0, 5);
      const g = parse(match[1]);
      const d = parse(match[2]);
      while (g.length < 5) g.push(0);
      while (d.length < 5) d.push(0);
      return { g, d };
    }
  }
  return { g: [0, 0, 0, 0, 0], d: [0, 0, 0, 0, 0] };
}

type Props = {
  value: Capsules;
  onChange?: (v: Capsules) => void;
  editing: boolean;
  couleur: string;
};

export function CapsulesMesures({ value, onChange, editing, couleur }: Props) {
  function setVal(side: "g" | "d", idx: number, v: number) {
    if (!onChange) return;
    const next = { g: [...value.g], d: [...value.d] };
    next[side][idx] = v;
    onChange(next);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {(["g", "d"] as const).map(side => (
        <div key={side} style={{ background: `${couleur}06`, border: `1px solid ${couleur}20`, borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: couleur, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Main {side === "g" ? "Gauche" : "Droite"}
          </div>
          {DOIGTS.map((doigt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: i < 4 ? 8 : 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: couleur, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, fontSize: 13, color: "#444" }}>{doigt}</div>
              {editing
                ? <input
                    type="number"
                    min={0}
                    max={20}
                    value={value[side][i] ?? 0}
                    onChange={e => setVal(side, i, Number(e.target.value))}
                    style={{ width: 54, padding: "3px 6px", border: "1px solid #e0e0e0", borderRadius: 5, fontSize: 13, textAlign: "center", boxSizing: "border-box" }}
                  />
                : <div style={{ fontSize: 13, fontWeight: 600, color: "#333", minWidth: 24, textAlign: "right" }}>
                    {value[side][i] ?? 0}
                  </div>
              }
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
