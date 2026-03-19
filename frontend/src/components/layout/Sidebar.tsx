import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Grid3X3,
  Activity,
  FolderUp,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "../ThemeToggle";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Target, label: "Predictions", path: "/predictions" },
  { icon: FolderUp, label: "My Data", path: "/upload" },
  { icon: Grid3X3, label: "Correlation Matrix", path: "/correlation" },
  { icon: Activity, label: "Volatility Regimes", path: "/volatility" },
  { icon: TrendingUp, label: "Factor Analysis", path: "/factors" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
        "border-r border-border bg-sidebar flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center w-full")}>
          <div className="relative">
            <Zap className="h-7 w-7 text-primary animate-pulse-glow" />
            <div className="absolute inset-0 blur-md bg-primary/30" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg tracking-tight">
              <span className="text-gradient">SignalM</span>
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "hover:bg-sidebar-accent group relative overflow-hidden",
                isActive
                  ? "bg-primary/10 text-primary neon-border"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive && "text-primary"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
                {isActive && (
                  <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <span className="text-xs text-muted-foreground">Theme</span>
          )}
          <ThemeToggle />
        </div>
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground",
            "transition-colors hover:bg-sidebar-accent hover:text-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
