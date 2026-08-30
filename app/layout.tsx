import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { AccentColorProvider } from "@/lib/accent-color";
import PushNotifications from "@/app/components/PushNotifications";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "rdvous",
  description: "Réservez en ligne chez vos professionnels du bien-être préférés",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "rdvous",
    startupImage: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        `}</style>
      </head>
      <body className={`${cormorant.className} ${inter.className}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <AccentColorProvider>{children}</AccentColorProvider>
        {/* Se désactive tout seul hors application native, d'où le montage global
            plutôt que dans /app : la coquille navigue aussi vers /mon-compte et
            vers les fiches salon. */}
        <PushNotifications />
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }` }} />
      </body>
    </html>
  );
}
