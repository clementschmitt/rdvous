import { SalonProvider } from "@/lib/salon-context";
import Header from "@/app/components/Header";
import UpgradeBanner from "@/app/components/UpgradeBanner";
import SmsCreditsBanner from "@/app/components/SmsCreditsBanner";
import { T } from "@/lib/theme";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SalonProvider>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <Header />
        <UpgradeBanner />
        <SmsCreditsBanner />
        {children}
      </div>
    </SalonProvider>
  );
}
