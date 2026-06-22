import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { useAuthUser } from "@/lib/auth-store";

export function ProfileTab() {
  const user = useAuthUser((s) => s.user);
  const hydrate = useAuthUser((s) => s.hydrate);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return <p className="text-sm text-muted-foreground">Not signed in.</p>;

  const save = async () => {
    if (pw && pw !== pw2) { toast.error("Passwords don't match"); return; }
    if (pw && pw.length < 8) { toast.error("Password must be 8+ chars"); return; }
    setSaving(true);
    try {
      await api.auth.update({
        phone: phone !== user.phone ? phone : undefined,
        password: pw || undefined,
      });
      toast.success("Profile updated");
      setPw(""); setPw2("");
      await hydrate();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border bg-card p-5 max-w-lg space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Full Name</Label>
        <Input value={user.fullName} disabled />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Email</Label>
        <Input value={user.email} disabled />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Role</Label>
        <Input value={user.role.replace("_", " ")} disabled className="capitalize" />
      </div>
      {user.zones.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Zones</Label>
          <Input value={user.zones.join(", ")} disabled />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Phone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-medium">Change password</p>
        <div className="space-y-1.5">
          <Label className="text-xs">New password</Label>
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Confirm new password</Label>
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
      </div>
      <Button size="sm" className="gap-1.5" disabled={saving} onClick={save}>
        <Save size={12} /> {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
