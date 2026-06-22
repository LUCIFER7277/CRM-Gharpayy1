import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-store";
import { api } from "@/lib/api/client";
import {
  LogOut, Building2, BarChart2, Package, ClipboardCheck,
  PlusCircle, Calendar, Bell, User, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export function PropertyOwnerShell({ children }: { children: React.ReactNode }) {
  const router = useRouterState();
  const location = router.location.pathname;
  const navigate = useNavigate();
  const user = useAuthUser((s) => s.user);
  const loading = useAuthUser((s) => s.loading);

  const isOwnerAuthenticated = !!user && user.role === "owner";

  const handleLogout = async () => {
    await api.logout();
    useAuthUser.getState().setUser(null);
    void navigate({ to: "/login", search: { redirect: "/" } });
  };

  // Redirect unauthenticated users or non-owners to the common login
  useEffect(() => {
    if (loading) return;
    if (!user) {
      // /login route requires a search param with redirect
      void navigate({ to: "/login", search: { redirect: location } });
      return;
    }
    if (user.role !== "owner") {
      void navigate({ to: "/" });
    }
  }, [user, loading, location, navigate]);

  // While auth is resolving, render nothing (AuthGate already shows a spinner globally)
  if (loading || !isOwnerAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-[#FBFBFC] w-full">
        {children}
      </div>
    );
  }

  const navItems = [
    { href: "/property-owner/dashboard", icon: BarChart2, label: "Dashboard" },
    { href: "/property-owner/properties", icon: Building2, label: "Properties" },
    { href: "/property-owner/properties/new", icon: PlusCircle, label: "Add Property" },
    { href: "/property-owner/inventory", icon: Package, label: "Inventory" },
    { href: "/property-owner/visits", icon: Calendar, label: "Visits" },
    { href: "/property-owner/notifications", icon: Bell, label: "Notifications" },
    { href: "/property-owner/profile", icon: User, label: "Profile" },
    { href: "/property-owner/bookings", icon: ClipboardList, label: "Bookings" },
    { href: "/property-owner/approvals", icon: ClipboardCheck, label: "Approvals" },
  ];

  const mobileNav = navItems.slice(0, 5);

  return (
    <div className={cn("min-h-[100dvh] w-full flex flex-col pb-16 md:pb-0 md:flex-row bg-[#F0F4FF] text-slate-900")}>
      <aside className="hidden md:flex flex-col w-64 border-r border-border/10 bg-card/50 backdrop-blur shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏘️</span>
            <div>
              <h1 className="text-xl font-black font-display text-primary leading-none">Gharpayy</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Owner Portal</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">PG OWNER</span>
            {user?.fullName && (
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.fullName}</span>
            )}
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isExactMatch = location === item.href;
            const isPrefixMatch = location.startsWith(item.href + "/") && item.href !== "/pg";
            const hasMoreSpecificMatch = navItems.some(other => other.href !== item.href && location.startsWith(other.href) && other.href.length > item.href.length);
            const active = isExactMatch || (isPrefixMatch && !hasMoreSpecificMatch);
            return (
              <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} isOwner={true} />
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/10 space-y-1">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-destructive transition-colors rounded-md"
          >
            <LogOut className="w-5 h-5" />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 w-full flex flex-col overflow-y-auto">
        <div className={cn(
          "md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10 border-b bg-background/90 border-border/10 backdrop-blur"
        )}>
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🏘️</span>
            <div>
              <span className="text-base font-black font-display leading-none text-primary">Gharpayy</span>
              <span className="text-[9px] font-bold ml-1 opacity-60 uppercase tracking-widest text-foreground">Owner Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLogout} title="Log out">
              <LogOut className="w-5 h-5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border/10 flex items-center justify-around px-2 z-50">
        {mobileNav.map(item => (
          <MobileNavItem key={item.href} href={item.href} icon={item.icon} label={item.label}
            active={location === item.href || (item.href !== "/" && location.startsWith(item.href))} />
        ))}
      </nav>
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active, isOwner }: { href: string; icon: any; label: string; active: boolean; isOwner?: boolean }) {
  return (
    <Link to={href} className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative",
      isOwner && active ? "bg-primary text-primary-foreground shadow-sm" : active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
    )}>
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function MobileNavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link to={href} className={cn(
      "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    )}>
      <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
