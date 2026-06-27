import { ReactNode } from "react";
import AppBottomNav from "@/app/components/AppBottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div style={{ paddingBottom: 80 }}>{children}</div>
      <AppBottomNav />
    </>
  );
}
