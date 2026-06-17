"use client";

import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };
type ApiMessage = { role: string; content: string };

export default function ChatWidget({ salonId, couleur }: { salonId: string; couleur: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Bonjour ! Je suis votre assistante. Je peux répondre à vos questions et vous aider à prendre rendez-vous. 😊" },
  ]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const newApiHistory: ApiMessage[] = [...apiHistory, { role: "user", content: text }];
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setApiHistory(newApiHistory);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newApiHistory, salon_id: salonId }),
      });
      const data = await res.json();
      const assistantText: string = data.text || "Une erreur s'est produite. Veuillez réessayer.";
      setMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
      setApiHistory(prev => [...prev, { role: "assistant", content: assistantText }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Une erreur s'est produite. Veuillez réessayer dans un instant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .chat-send-btn:hover:not(:disabled) { filter: brightness(0.9); }
        .chat-bubble-btn:hover { transform: scale(1.08) !important; }
      `}</style>

      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24, width: 356, height: 480,
          background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", zIndex: 1000, overflow: "hidden",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          <div style={{ background: couleur, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Votre assistante</div>
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, marginTop: 2 }}>Répond instantanément</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
            >×</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", padding: "10px 13px",
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? couleur : "#f0f0ee",
                  color: m.role === "user" ? "#fff" : "#1a1a1a",
                  fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 4px", background: "#f0f0ee", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "#bbb",
                      animation: "chatDot 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ borderTop: "1px solid #ebebeb", padding: "10px 12px", display: "flex", gap: 8, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Votre message..."
              disabled={loading}
              style={{
                flex: 1, border: "1px solid #e0e0de", borderRadius: 20, padding: "9px 14px",
                fontSize: 13.5, outline: "none", fontFamily: "inherit",
                background: loading ? "#fafaf9" : "#fff", color: "#1a1a1a",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="chat-send-btn"
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: input.trim() && !loading ? couleur : "#e0e0de",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="chat-bubble-btn"
        style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
          borderRadius: "50%", background: couleur, border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s",
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </>
  );
}
