import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <main
        className="transition-all duration-300"
        style={{ paddingLeft: collapsed ? "4rem" : "16rem" }}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
