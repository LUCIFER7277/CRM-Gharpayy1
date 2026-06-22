/**
 * Profile / account menu in the AppShell header.
 *
 * Surfaces:
 *  - Add Lead (jumps straight to the universal lead creator)
 *  - Switch Role (Flow Ops / TCM / HR / Owner)
 *  - Pick TCM (visible only when in TCM mode)
 *  - Settings, Help, Sign out
 *
 * This keeps power-user actions one click away from any screen.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel } from "@/lib/role-labels";
import { useAuthUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import {
  UserRound,
  UserPlus,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  RefreshCw,
  Building2,
  ShieldCheck,
  Target,
} from "lucide-react";
import { toast } from "sonner";

const ROLE_META = {
  "flow-ops": { label: "Flow Ops", dot: "bg-info", initials: "FO", icon: Target },
  tcm: { label: "TCM", dot: "bg-accent", initials: "TC", icon: Users },
  hr: { label: "HR / Leadership", dot: "bg-success", initials: "HR", icon: ShieldCheck },
  owner: { label: "Owner Portal", dot: "bg-warning", initials: "OW", icon: Building2 },
  "super-admin": { label: "Super Admin", dot: "bg-destructive", initials: "SA", icon: ShieldCheck },
} as const;

export function ProfileMenu() {
  const navigate = useNavigate();
  const authUser = useAuthUser((s) => s.user);
  const meta =
    ROLE_META[(authUser?.role ?? "flow-ops").replace(/_/g, "-") as keyof typeof ROLE_META] ??
    ROLE_META["flow-ops"];
  const personName = authUser?.fullName ?? authUser?.username ?? authUser?.email ?? "Account";
  const computeInitials = (n: string) =>
    n
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U";
  const initials = computeInitials(personName);

  const roleDisplay = authUser?.role ? roleLabel(authUser.role) : "Flow Ops";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Open profile menu"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-accent"
        >
          {initials}
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
              meta.dot,
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <div
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold",
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">{roleDisplay}</div>
            <div className="truncate text-sm font-medium">{personName}</div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/help">
            <HelpCircle className="mr-2 h-4 w-4" /> How to use
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            try {
              const { useAuthUser } = await import("@/lib/auth-store");
              await useAuthUser.getState().signOut();
            } catch {
              // ignore - fall through to redirect
            } finally {
              toast.success("Signed out");
              // Hard reload to clear all in-memory state (sockets, stores, caches)
              if (typeof window !== "undefined") {
                window.location.href = "/login?redirect=%2F";
              } else {
                navigate({ to: "/login", search: { redirect: "/" } });
              }
            }
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { UserRound };
