import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, tokenStore } from "@/lib/api/client";
import { useAuthUser } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · Gharpayy CRM" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s.redirect === "string" ? s.redirect : "/" }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const setUser = useAuthUser((s) => s.setUser);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If already logged in, jump straight to the redirect target.
  useEffect(() => {
    if (tokenStore.get()) {
      api.auth.me().then((r) => {
        setUser(r.user);
        nav({ to: search.redirect || "/" });
      }).catch(() => undefined);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await api.login(identifier.trim(), password);
      setUser(r.user);
      if (r.user.role === "owner") {
        nav({ to: search.redirect?.startsWith("/property-owner") ? search.redirect : "/property-owner/dashboard" });
      } else {
        nav({ to: search.redirect || "/" });
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-display font-bold leading-tight">Gharpayy CRM</h1>
            <p className="text-xs text-muted-foreground">Sign in to your workspace</p>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email or Username</Label>
          <Input
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="superadmin@gharpayy.com"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button className="w-full" disabled={busy || !identifier || !password} onClick={submit}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          API: <code className="text-foreground">{api.apiUrl}</code>
        </p>
      </Card>
    </div>
  );
}
