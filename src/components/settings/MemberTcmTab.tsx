import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { useAuthUser } from "@/lib/auth-store";

export function MemberTcmTab() {
  const user = useAuthUser((s) => s.user);
  const hydrate = useAuthUser((s) => s.hydrate);
  const [saving, setSaving] = useState(false);

  if (!user) return <p className="text-sm text-muted-foreground">Not signed in.</p>;

  const enabled = user.isTcm !== false;

  const save = async (nextEnabled: boolean) => {
    setSaving(true);
    try {
      await api.auth.update({ isTcm: nextEnabled });
      toast.success(nextEnabled ? "TCM enabled" : "TCM disabled");
      await hydrate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 max-w-lg space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <p className="text-sm font-medium">TCM capability</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <div className="text-sm font-medium text-foreground">Available as TCM</div>
          <div className="mt-1 text-xs text-muted-foreground">
            When enabled, your account is treated as an active TCM in assignment flows.
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={save} disabled={saving} />
      </div>
    </div>
  );
}
