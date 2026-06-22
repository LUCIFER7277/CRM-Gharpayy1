import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const TABS = [
  { to: "/admin", label: "Cockpit" },
  { to: "/admin/supreme", label: "Supreme" },
  { to: "/admin/command", label: "Command" },
  { to: "/admin/war-room", label: "War-Room TV" },
  { to: "/admin/leads", label: "Master Leads" },
  { to: "/admin/visits", label: "Master Visits" },
  { to: "/admin/bookings", label: "Bookings" },
  { to: "/admin/owner-bookings", label: "Owner Bookings" },
  { to: "/admin/tenants", label: "Tenants" },
  { to: "/admin/calendar", label: "Calendar" },
  { to: "/admin/owners", label: "Owners" },
  { to: "/admin/people", label: "People 360" },
  { to: "/admin/intelligence", label: "Intelligence" },
  { to: "/admin/property", label: "Property Pulse" },
  { to: "/admin/impact", label: "Impact Analytics" },
  { to: "/admin/audit", label: "Audit Log" },
  { to: "/admin/exports", label: "Exports" },
  { to: "/admin/settings", label: "Settings" },
];

export function AdminShell({ children, title, sub }: { children: ReactNode; title: string; sub?: string }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-destructive font-semibold">Super Admin · Full control</div>
          <div className="text-lg font-display font-semibold">{title}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
        <nav className="flex items-center gap-1 flex-wrap text-xs">
          {TABS.map((t) => {
            const active = t.to === "/admin" ? path === "/admin" : path === t.to || path.startsWith(t.to + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
