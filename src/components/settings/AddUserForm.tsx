import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, MapPin, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type ManagedRole } from "@/lib/api/client";
import { managedRoleLabel } from "@/lib/role-labels";

export function AddUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "" as ManagedRole | "",
  });
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [zoneName, setZoneName] = useState<string>("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.zones
      .list()
      .then(setZones)
      .catch(() => undefined);
  }, []);

  const needsZone = form.role === "admin" || form.role === "member" || form.role === "tcm";

  const submit = async () => {
    if (!form.fullName || !form.email || !form.password || !form.role) {
      toast.error("Name, email, password, role are required");
      return;
    }
    if (needsZone && !zoneName) {
      toast.error("Select a zone");
      return;
    }
    setBusy(true);
    try {
      await api.users.create({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
        zones: needsZone ? [zoneName] : [],
      });
      toast.success("User created");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Full Name *</Label>
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email *</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@gharpayy.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91…"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Initial Password *</Label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="pr-9"
              placeholder="min 8 chars"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              tabIndex={-1}
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Role *</Label>
        <Select
          value={form.role}
          onValueChange={(v) => setForm({ ...form, role: v as ManagedRole })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manager">{managedRoleLabel("manager")}</SelectItem>
            <SelectItem value="admin">{managedRoleLabel("admin")}</SelectItem>
            <SelectItem value="member">{managedRoleLabel("member")}</SelectItem>
            <SelectItem value="owner">{managedRoleLabel("owner")}</SelectItem>
            <SelectItem value="tcm">{managedRoleLabel("tcm")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {needsZone && (
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <MapPin size={12} /> Zone *
          </Label>
          <Select value={zoneName} onValueChange={setZoneName}>
            <SelectTrigger>
              <SelectValue placeholder="Select zone…" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.name}>
                  {z.name}
                </SelectItem>
              ))}
              {zones.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No zones yet - add zones in Settings → Zones
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button className="w-full gap-1.5" disabled={busy} onClick={submit}>
        <UserPlus size={14} /> {busy ? "Creating…" : "Create user"}
      </Button>
    </div>
  );
}
