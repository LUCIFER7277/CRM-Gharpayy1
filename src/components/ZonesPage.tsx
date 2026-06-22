import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Map as MapIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { api, type Zone } from "@/lib/api/client";

const ZONE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

type FormState = { name: string; city: string; areas: string; color: string };
const emptyForm: FormState = { name: "", city: "Bangalore", areas: "", color: ZONE_COLORS[0] };

export function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.zones.list();
      setZones(list);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.areas.trim()) {
      toast.error("Name and areas required");
      return;
    }
    setBusy(true);
    try {
      await api.zones.create({
        name: createForm.name.trim(),
        city: createForm.city.trim(),
        areas: createForm.areas.split(",").map((a) => a.trim()).filter(Boolean),
        color: createForm.color,
      });
      toast.success("Zone created");
      setCreateForm(emptyForm);
      setCreateOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (z: Zone) => {
    setEditing(z);
    setEditForm({
      name: z.name || "",
      city: z.city || "",
      areas: (z.areas || []).join(", "),
      color: z.color || ZONE_COLORS[0],
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.name.trim() || !editForm.areas.trim()) {
      toast.error("Name and areas required");
      return;
    }
    setBusy(true);
    try {
      await api.zones.update(editing.id, {
        name: editForm.name.trim(),
        city: editForm.city.trim(),
        areas: editForm.areas.split(",").map((a) => a.trim()).filter(Boolean),
        color: editForm.color,
      });
      toast.success("Zone updated");
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (z: Zone) => {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    try {
      await api.zones.remove(z.id);
      toast.success("Zone deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <MapIcon size={20} className="text-accent" /> Zone Management
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Geographic routing & team operations</p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{zones.length} active zones</p>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs rounded-xl">
              <Plus size={12} /> New Zone
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Zone</DialogTitle>
              <DialogDescription>Create a new zone to organize your leads and properties.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Zone name (e.g. Marathahalli Cluster)"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="text-xs"
              />
              <Input
                placeholder="City"
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                className="text-xs"
              />
              <Input
                placeholder="Areas (comma-separated: Marathahalli, Varthur, Kundalahalli)"
                value={createForm.areas}
                onChange={(e) => setCreateForm({ ...createForm, areas: e.target.value })}
                className="text-xs"
              />
              <div className="flex gap-2">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`color ${c}`}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${createForm.color === c ? "scale-125 border-foreground" : "border-transparent"}`}
                    style={{ background: c }}
                    onClick={() => setCreateForm({ ...createForm, color: c })}
                  />
                ))}
              </div>
              <Button className="w-full text-xs" onClick={handleCreate} disabled={busy}>
                {busy ? "Creating..." : "Create Zone"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <DialogDescription>Update the zone name and city information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Zone name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="text-xs"
            />
            <Input
              placeholder="City"
              value={editForm.city}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              className="text-xs"
            />
            <Input
              placeholder="Areas (comma-separated)"
              value={editForm.areas}
              onChange={(e) => setEditForm({ ...editForm, areas: e.target.value })}
              className="text-xs"
            />
            <div className="flex gap-2">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`color ${c}`}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${editForm.color === c ? "scale-125 border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                  onClick={() => setEditForm({ ...editForm, color: c })}
                />
              ))}
            </div>
            <Button className="w-full text-xs" onClick={handleUpdate} disabled={busy}>
              {busy ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-10 text-xs text-muted-foreground">
          No zones created yet. Create your first zone to start routing.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: zone.color || "#94a3b8" }}
                  />
                  <h3 className="font-display font-semibold text-sm text-foreground truncate">{zone.name}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(zone)} aria-label={`Edit ${zone.name}`}>
                    <Pencil size={12} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(zone)} aria-label={`Delete ${zone.name}`}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                <span className="font-medium text-foreground">City:</span> {zone.city || "NA"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(zone.areas || []).map((area, i) => (
                  <span key={`${area}-${i}`} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground">{area}</span>
                ))}
                {(!zone.areas || zone.areas.length === 0) && (
                  <span className="text-[10px] text-muted-foreground">No areas added</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
