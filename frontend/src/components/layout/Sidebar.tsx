import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Grid3X3,
  Activity,
  FolderUp,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "../ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Target, label: "Predictions", path: "/predictions" },
  { icon: FolderUp, label: "My Data", path: "/upload" },
  { icon: FlaskConical, label: "Backtester", path: "/backtester" },
  { icon: Grid3X3, label: "Correlation Matrix", path: "/correlation" },
  { icon: Activity, label: "Volatility Regimes", path: "/volatility" },
  { icon: TrendingUp, label: "Factor Analysis", path: "/factors" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const GUEST_LOCKED = new Set(["/upload"]);

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  /**
   * "desktop" → fixed aside with collapse toggle (default).
   * "mobile" → renders inside a Sheet drawer; ignores `collapsed`, hides the
   * collapse toggle, and calls `onNavigate` after each nav click so the parent
   * can close the drawer.
   */
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function Sidebar({
  collapsed,
  onCollapse,
  variant = "desktop",
  onNavigate,
}: SidebarProps) {
  const { signOut, user, isGuest, isDemoMode, exitGuestMode } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isMobile = variant === "mobile";
  // On mobile the drawer is always fully expanded.
  const isCollapsed = !isMobile && collapsed;

  const handleSignOut = async () => {
    exitGuestMode();
    await signOut();
    onNavigate?.();
    navigate("/auth", { replace: true });
  };

  const handleGuestLockedClick = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    toast({
      title: "Account required",
      description: `Sign up or log in to access ${label}.`,
    });
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar",
        isMobile
          ? "w-full"
          : cn(
              "fixed left-0 top-0 z-40 h-screen border-r border-border transition-all duration-300 ease-in-out",
              isCollapsed ? "w-16" : "w-64",
            ),
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <div
          className={cn(
            "flex items-center gap-3",
            isCollapsed && "w-full justify-center",
          )}
        >
          <img
            src="/logo.png"
            alt="SignalM"
            className="h-12 w-12 object-contain pb-2.5"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,229,160,0.5))" }}
          />
          {!isCollapsed && (
            <span className="font-semibold text-lg tracking-tight">
              <span className="text-gradient">SignalM</span>
            </span>
          )}
        </div>
      </div>

      {/* Guest banner */}
      {isGuest && !isDemoMode && !isCollapsed && (
        <div className="mx-2 mt-3 rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">Browsing as guest</p>
          <button
            onClick={() => {
              exitGuestMode();
              onNavigate?.();
              navigate("/auth");
            }}
            className="mt-1 text-xs font-medium text-[#00e5a0] hover:underline"
          >
            Sign up for full access →
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const locked = isGuest && !isDemoMode && GUEST_LOCKED.has(item.path);
          return locked ? (
            <button
              key={item.path}
              onClick={(e) => handleGuestLockedClick(e, item.label)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                "cursor-not-allowed opacity-40",
                isCollapsed && "justify-center px-2",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ) : (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => onNavigate?.()}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "bg-primary/10 text-primary neon-border"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  isCollapsed && "justify-center px-2",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                      isActive && "text-primary",
                    )}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                  {isActive && (
                    <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t border-border p-3">
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "justify-between",
          )}
        >
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">Theme</span>
          )}
          <ThemeToggle />
        </div>

        {/* User email / guest / demo label */}
        {!isCollapsed && (
          <div className="px-3 py-1">
            {user?.email ? (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            ) : isDemoMode ? (
              <p className="text-xs italic text-muted-foreground">Demo mode</p>
            ) : isGuest ? (
              <p className="text-xs italic text-muted-foreground">Guest</p>
            ) : null}
          </div>
        )}

        {!isDemoMode && (
          <button
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground",
              "transition-colors hover:bg-red-500/10 hover:text-red-400",
              isCollapsed && "justify-center px-2",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && (
              <span>{isGuest ? "Sign in" : "Sign out"}</span>
            )}
          </button>
        )}

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={() => onCollapse(!collapsed)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground",
              "transition-colors hover:bg-sidebar-accent hover:text-foreground",
              isCollapsed && "justify-center px-2",
            )}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}
