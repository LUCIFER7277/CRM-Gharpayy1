import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, KeyRound, MapPin, Pencil, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type ManagedUser, type Zone } from "@/lib/api/client";
import { roleLabel } from "@/lib/role-labels";

type RoleTab = "managers" | "admins" | "members" | "tcms" | "owners";
type EditForm = { fullName: string; email: string; phone: string; role: string; zones: string[] };

const isVisible = (u: ManagedUser) => {
  const s = (u.status || "active").toLowerCase();
  return s === "active" || s === "inactive";
};

export function RolesTab() {
  const [roleTab, setRoleTab] = useState<RoleTab>("managers");
  const [managers, setManagers] = useState<(ManagedUser & { admins?: ManagedUser[] })[]>([]);
  const [admins, setAdmins] = useState<ManagedUser[]>([]);
  const [members, setMembers] = useState<ManagedUser[]>([]);
  const [tcms, setTcms] = useState<ManagedUser[]>([]);
  const [owners, setOwners] = useState<ManagedUser[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: "",
    email: "",
    phone: "",
    role: "",
    zones: [],
  });
  const [updating, setUpdating] = useState(false);

  const sortedManagers = useMemo(
    () =>
      [...managers].sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" }),
      ),
    [managers],
  );
  const sortedAdmins = useMemo(
    () =>
      [...admins].sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" }),
      ),
    [admins],
  );
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" }),
      ),
    [members],
  );
  const sortedOwners = useMemo(
    () =>
      [...owners].sort((a, b) =>
        (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" }),
      ),
    [owners],
  );
  // kept tcms state for compatibility but TCMs are now a per-member capability

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, a, mem, t, own, z] = await Promise.all([
        api.managers.list(),
        api.admins.list(),
        api.members.list(),
        api.tcms.list().catch(() => [] as ManagedUser[]),
        api.owners.list().catch(() => [] as ManagedUser[]),
        api.zones.list().catch(() => [] as Zone[]),
      ]);
      setManagers((m || []).filter(isVisible));
      setAdmins((a || []).filter(isVisible));
      setMembers((mem || []).filter(isVisible));
      setTcms((t || []).filter(isVisible));
      setOwners((own || []).filter(isVisible));
      setZones(z || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);

  const startEdit = (u: ManagedUser, fallbackRole: string) => {
    setEditingId(u.id);
    setEditForm({
      fullName: u.fullName || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role || fallbackRole,
      zones: Array.isArray(u.zones) && u.zones.length > 0 ? [u.zones[0]] : [],
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (
      (editForm.role === "admin" || editForm.role === "member" || editForm.role === "tcm") &&
      editForm.zones.length !== 1
    ) {
      toast.error("Please select one zone");
      return;
    }
    try {
      setUpdating(true);
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
      };
      if (editForm.role === "admin" || editForm.role === "member" || editForm.role === "tcm") {
        payload.zones = editForm.zones;
      }
      await api.users.update(editingId, payload);
      toast.success("Updated successfully");
      setEditingId(null);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const resetPassword = async (id: string, name: string) => {
    const pw = prompt(`Enter new password for ${name}:`);
    if (!pw) return;
    if (pw.length < 8) {
      toast.error("Password too short (min 8 chars)");
      return;
    }
    try {
      await api.users.resetPassword(id, pw);
      toast.success("Password updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Role sub-tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
        {(
          [
            ["managers", "HR/Leadership"],
            ["admins", "Super Admin"],
            ["members", "Flow Ops"],
            ["tcms", "TCM"],
            ["owners", "Property Owner"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => {
              setRoleTab(t);
              setExpandedId(null);
              setEditingId(null);
            }}
            className={
              "px-4 py-1.5 rounded-md text-xs font-medium transition-colors " +
              (roleTab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Managers */}
          {roleTab === "managers" &&
            sortedManagers.map((m) => (
              <div key={m.id} className="border rounded-xl bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <span className="text-blue-500 font-semibold text-sm">
                        {m.fullName?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight
                      size={16}
                      className={"transition-transform " + (expandedId === m.id ? "rotate-90" : "")}
                    />
                  </div>
                </button>

                {expandedId === m.id && (
                  <div className="border-t p-4 space-y-4 bg-secondary/10">
                    {editingId === m.id ? (
                      <EditForm
                        form={editForm}
                        setForm={setEditForm}
                        zones={zones}
                        onSave={saveEdit}
                        onCancel={() => setEditingId(null)}
                        saving={updating}
                      />
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Phone: <span className="text-foreground">{m.phone || "N/A"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Username: <span className="text-foreground">{m.username}</span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(m, "manager")}>
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resetPassword(m.id, m.fullName)}
                          >
                            <KeyRound size={12} />
                          </Button>
                        </div>
                      </div>
                    )}

                    {(m.admins?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Admins under {m.fullName}
                        </p>
                        {m.admins!.map((a) => (
                          <div
                            key={a.id}
                            className="bg-background rounded-lg p-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-medium">{a.fullName}</p>
                              <p className="text-[11px] text-muted-foreground">{a.email}</p>
                              {a.zones?.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <MapPin size={10} className="text-muted-foreground" />
                                  <p className="text-[10px] text-muted-foreground">
                                    {a.zones.join(", ")}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {/* Admins */}
          {roleTab === "admins" &&
            sortedAdmins.map((a) => {
              const matchingMembers = sortedMembers.filter(
                (mem) => mem.zones && a.zones && mem.zones.some((mz) => a.zones.includes(mz)),
              );
              return (
                <div key={a.id} className="border rounded-xl bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <span className="text-green-500 font-semibold text-sm">
                          {a.fullName?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">{a.fullName}</p>
                        <p className="text-xs text-muted-foreground">{a.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.zones?.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {a.zones.join(", ")}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {matchingMembers.length} Members
                      </Badge>
                      <ChevronRight
                        size={16}
                        className={
                          "transition-transform " + (expandedId === a.id ? "rotate-90" : "")
                        }
                      />
                    </div>
                  </button>

                  {expandedId === a.id && (
                    <div className="border-t p-4 space-y-4 bg-secondary/10">
                      {editingId === a.id ? (
                        <EditForm
                          form={editForm}
                          setForm={setEditForm}
                          zones={zones}
                          onSave={saveEdit}
                          onCancel={() => setEditingId(null)}
                          saving={updating}
                        />
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Phone: <span className="text-foreground">{a.phone || "N/A"}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Username: <span className="text-foreground">{a.username}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Zones:{" "}
                              <span className="text-foreground">
                                {a.zones?.join(", ") || "None"}
                              </span>
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(a, "admin")}>
                              <Pencil size={12} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => resetPassword(a.id, a.fullName)}
                            >
                              <KeyRound size={12} />
                            </Button>
                          </div>
                        </div>
                      )}

                      {matchingMembers.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Members</p>
                          {matchingMembers.map((mem) => (
                            <div
                              key={mem.id}
                              className="bg-background rounded-lg p-3 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-medium">{mem.fullName}</p>
                                <p className="text-[11px] text-muted-foreground">{mem.email}</p>
                                {mem.zones?.length > 0 && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <MapPin size={10} className="text-muted-foreground" />
                                    <p className="text-[10px] text-muted-foreground">
                                      {mem.zones.join(", ")}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No members in matching zones
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Members */}
          {roleTab === "members" &&
            sortedMembers.map((mem) => (
              <div key={mem.id} className="border rounded-xl bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === mem.id ? null : mem.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <span className="text-purple-500 font-semibold text-sm">
                        {mem.fullName?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{mem.fullName}</p>
                      <p className="text-xs text-muted-foreground">{mem.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {mem.zones?.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {mem.zones.join(", ")}
                      </Badge>
                    )}
                    <ChevronRight
                      size={16}
                      className={
                        "transition-transform " + (expandedId === mem.id ? "rotate-90" : "")
                      }
                    />
                  </div>
                </button>

                {expandedId === mem.id && (
                  <div className="border-t p-4 space-y-4 bg-secondary/10">
                    {editingId === mem.id ? (
                      <EditForm
                        form={editForm}
                        setForm={setEditForm}
                        zones={zones}
                        onSave={saveEdit}
                        onCancel={() => setEditingId(null)}
                        saving={updating}
                      />
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Phone: <span className="text-foreground">{mem.phone || "N/A"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Username: <span className="text-foreground">{mem.username}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Zones:{" "}
                            <span className="text-foreground">
                              {mem.zones?.join(", ") || "None"}
                            </span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(mem, "member")}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resetPassword(mem.id, mem.fullName)}
                          >
                            <KeyRound size={12} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {/* TCM role users + Flow Ops members with TCM capability */}
          {roleTab === "tcms" && (
            <>
              {tcms
                .filter((u) => u.role === "tcm")
                .map((tcmUser) => (
                  <div key={tcmUser.id} className="border rounded-xl bg-card overflow-hidden">
                    <div className="w-full flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                          <span className="text-pink-500 font-semibold text-sm">
                            {tcmUser.fullName?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">{tcmUser.fullName}</p>
                          <p className="text-xs text-muted-foreground">{tcmUser.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {tcmUser.zones?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {tcmUser.zones.join(", ")}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {roleLabel(tcmUser.role)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              {sortedMembers.map((mem) => {
                const isTcm = mem.isTcm === true;
                return (
                  <div key={mem.id} className="border rounded-xl bg-card overflow-hidden">
                    <div className="w-full flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center">
                          <span className="text-pink-500 font-semibold text-sm">
                            {mem.fullName?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">{mem.fullName}</p>
                          <p className="text-xs text-muted-foreground">{mem.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {mem.zones?.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {mem.zones.join(", ")}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {roleLabel(mem.role)}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">TCM cap.</p>
                          <Switch
                            checked={isTcm}
                            onCheckedChange={async (v) => {
                              try {
                                setUpdating(true);
                                await api.users.update(mem.id, { isTcm: !!v });
                                toast.success("Updated");
                                loadData();
                              } catch (e) {
                                toast.error((e as Error).message);
                              } finally {
                                setUpdating(false);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {tcms.filter((u) => u.role === "tcm").length === 0 && sortedMembers.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No TCM users yet. Add one in Users → Add User.
                </p>
              )}
            </>
          )}

          {/* Owners */}
          {roleTab === "owners" &&
            sortedOwners.map((own) => (
              <div key={own.id} className="border rounded-xl bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === own.id ? null : own.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <span className="text-amber-500 font-semibold text-sm">
                        {own.fullName?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{own.fullName}</p>
                      <p className="text-xs text-muted-foreground">{own.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      Property Owner
                    </Badge>
                    <ChevronRight
                      size={16}
                      className={
                        "transition-transform " + (expandedId === own.id ? "rotate-90" : "")
                      }
                    />
                  </div>
                </button>

                {expandedId === own.id && (
                  <div className="border-t p-4 space-y-4 bg-secondary/10">
                    {editingId === own.id ? (
                      <EditForm
                        form={editForm}
                        setForm={setEditForm}
                        zones={zones}
                        onSave={saveEdit}
                        onCancel={() => setEditingId(null)}
                        saving={updating}
                      />
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Phone: <span className="text-foreground">{own.phone || "N/A"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Username: <span className="text-foreground">{own.username}</span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(own, "owner")}>
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resetPassword(own.id, own.fullName)}
                          >
                            <KeyRound size={12} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          {roleTab === "managers" && managers.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No managers yet</p>
          )}
          {roleTab === "admins" && admins.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No admins yet</p>
          )}
          {roleTab === "members" && members.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No members yet</p>
          )}
          {roleTab === "owners" && owners.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No property owners yet</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ========== Inline Edit Form ========== */
function EditForm({
  form,
  setForm,
  zones,
  onSave,
  onCancel,
  saving,
}: {
  form: EditForm;
  setForm: (f: EditForm) => void;
  zones: Zone[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Full Name</Label>
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Email</Label>
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="text-xs"
          />
        </div>
      </div>

      {(form.role === "admin" || form.role === "member" || form.role === "tcm") &&
        zones.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <MapPin size={12} /> Zone
            </Label>
            <Select
              value={form.zones[0] ?? ""}
              onValueChange={(v) => setForm({ ...form, zones: v ? [v] : [] })}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select zone…" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.name}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
