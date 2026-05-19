import { SalonProvider } from "@/lib/salon-context";
import Header from "@/app/components/Header";
import { T } from "@/lib/theme";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SalonProvider>
      <div style={{ minHeight: "100vh", background: T.bg }}>
        <Header />
        {children}
      </div>
    </SalonProvider>
  );
}
