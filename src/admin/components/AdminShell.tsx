import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { 
  Search, Bell, HelpCircle, 
  Home, Gauge, Zap, Command, Tv, Users, CalendarPlus, 
  CalendarCheck, Building, UsersRound, Calendar, UserCheck, 
  UserCircle, Brain, Building2, BarChart3, ClipboardList, Download, Settings
} from "lucide-react";
import type { ReactNode } from "react";

const TABS = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/admin", label: "Cockpit", icon: Gauge },
  { to: "/admin/supreme", label: "Supreme", icon: Zap },
  { to: "/admin/command", label: "Command", icon: Command },
  { to: "/admin/war-room", label: "War-Room TV", icon: Tv },
  { to: "/admin/leads", label: "Master Leads", icon: Users },
  { to: "/admin/visits", label: "Master Visits", icon: CalendarPlus },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/admin/owner-bookings", label: "Owner Bookings", icon: Building },
  { to: "/admin/tenants", label: "Tenants", icon: UsersRound },
  { to: "/admin/calendar", label: "Calendar", icon: Calendar },
  { to: "/admin/owners", label: "Owners", icon: UserCheck },
  { to: "/admin/people", label: "People 360", icon: UserCircle },
  { to: "/admin/intelligence", label: "Intelligence", icon: Brain },
  { to: "/admin/property", label: "Property Pulse", icon: Building2 },
  { to: "/admin/impact", label: "Impact Analytics", icon: BarChart3 },
  { to: "/admin/audit", label: "Audit Log", icon: ClipboardList },
  { to: "/admin/exports", label: "Exports", icon: Download },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, title, sub }: { children: ReactNode; title: string; sub?: string }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="space-y-6 min-w-0 w-full">
      <div className="flex flex-col min-w-0 w-full">
        {/* Header matching exact design */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-destructive font-bold mb-1">
              <span>Super Admin &middot; Full Control</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground truncate">{title}</h1>
              <div className="flex items-center gap-1 mt-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                <span className="text-xs text-muted-foreground font-medium">Live</span>
              </div>
            </div>
            {sub && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {sub}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative group hidden sm:block">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="pl-8 pr-12 py-1.5 h-8 text-sm bg-background border border-border rounded-md w-64 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/70"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <kbd className="text-[9px] bg-muted px-1 py-0.5 rounded border font-mono font-medium text-muted-foreground">⌘</kbd>
                <kbd className="text-[9px] bg-muted px-1 py-0.5 rounded border font-mono font-medium text-muted-foreground">K</kbd>
              </div>
            </div>

            <button className="relative w-8 h-8 rounded-full border border-border flex items-center justify-center bg-background hover:bg-muted transition-colors">
              <Bell className="w-4 h-4 text-foreground shrink-0" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-[8px] font-bold text-destructive-foreground rounded-full flex items-center justify-center border-2 border-background">
                6
              </span>
            </button>

            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center bg-background hover:bg-muted transition-colors">
              <HelpCircle className="w-4 h-4 text-foreground shrink-0" />
            </button>

            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-background shrink-0">
              SA
            </div>
          </div>
        </header>

        {/* Clean Tabs Row */}
        <div className="border-b border-border mt-4 min-w-0 w-full">
          <nav className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent snap-x min-w-0">
            {TABS.map((t) => {
              const active = t.to === "/" ? path === "/" : t.to === "/admin" ? path === "/admin" : path === t.to || path.startsWith(t.to + "/");
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "px-3 py-2 text-sm font-medium transition-all whitespace-nowrap snap-start flex items-center gap-1.5 border-b-2",
                    active 
                      ? "text-blue-600 border-blue-600 bg-blue-50/50" 
                      : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <Icon className={cn("w-4 h-4", active ? "text-blue-600" : "opacity-70")} />
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}
