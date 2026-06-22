// Global auth gate. Until the user has a valid JWT session (hydrated from
// /api/auth/me), nothing in the app renders except the login screen.
//
// JWT flow (matches the old CRM):
//   1. POST /api/auth/login → { token, user }
//   2. Token saved to localStorage (`gharpayy.access_token`) + httpOnly cookie
//   3. Every request sends Authorization: Bearer <token>
//   4. On boot, /api/auth/me re-validates the token and rehydrates the user
import { useEffect, type ReactNode } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuthUser } from "@/lib/auth-store";
import { tokenStore } from "@/lib/api/client";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthUser((s) => s.user);
  const loading = useAuthUser((s) => s.loading);
  const hydrate = useAuthUser((s) => s.hydrate);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => { hydrate(); }, [hydrate]);

  const hasToken = typeof window !== "undefined" && !!tokenStore.get();
  const isLoginRoute = pathname === "/login";
  const isOwnerRoute = pathname.startsWith("/property-owner");

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (user || isLoginRoute || loading) return;
    const redirect = pathname || "/";
    void navigate({ to: "/login", search: { redirect }, replace: true }).catch(() => undefined);
  }, [user, isLoginRoute, loading, pathname, navigate]);

  // Redirect authenticated owners away from the main CRM shell to their portal
  useEffect(() => {
    if (!user || loading || isOwnerRoute || isLoginRoute) return;
    if (user.role === "owner") {
      void navigate({ to: "/property-owner/dashboard", replace: true }).catch(() => undefined);
    }
  }, [user, loading, isOwnerRoute, isLoginRoute, navigate]);

  const spinner = (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  // Resolving auth: token present but user not yet loaded
  if (hasToken && !user && loading) return spinner;

  // Not signed in and not already on login → spinner while useEffect redirects
  if (!user && !isLoginRoute) return spinner;

  // Owner is authenticated but not yet on the owner portal → spinner while redirecting
  if (user?.role === "owner" && !isOwnerRoute && !isLoginRoute) return spinner;

  return <>{children}</>;
}
