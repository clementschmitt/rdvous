"use client";
import { createContext, useContext, useEffect, useState } from "react";

export const ACCENT_COLORS = [
  { key: "noir",       hex: "#1a1a1a", label: "Noir" },
  { key: "bordeaux",   hex: "#7c2d42", label: "Bordeaux" },
  { key: "sauge",      hex: "#4a6741", label: "Sauge" },
  { key: "marine",     hex: "#1e3a5f", label: "Marine" },
  { key: "terracotta", hex: "#9b4f2a", label: "Terracotta" },
  { key: "mauve",      hex: "#5e3d7a", label: "Mauve" },
];

const DEFAULT = "#1a1a1a";
const LS_KEY = "rdvous_accent";

const AccentColorContext = createContext<{
  color: string;
  setColor: (hex: string) => void;
}>({ color: DEFAULT, setColor: () => {} });

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [color, setColorState] = useState(DEFAULT);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) setColorState(saved);
  }, []);

  function setColor(hex: string) {
    setColorState(hex);
    localStorage.setItem(LS_KEY, hex);
  }

  return (
    <AccentColorContext.Provider value={{ color, setColor }}>
      {children}
    </AccentColorContext.Provider>
  );
}

export const useAccentColor = () => useContext(AccentColorContext);
