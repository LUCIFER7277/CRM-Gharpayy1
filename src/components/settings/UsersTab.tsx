import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MoreVertical, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type ManagedUser, type UserStatus } from "@/lib/api/client";
import { AddUserForm } from "./AddUserForm";
import { roleLabel } from "@/lib/role-labels";

export function UsersTab() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<UserStatus>("active");
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.users.list();
      setUsers(list);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users
        .filter((u) => (u.status || "active") === tab)
        .sort((a, b) =>
          (a.fullName || "").localeCompare(b.fullName || "", undefined, { sensitivity: "base" }),
        ),
    [users, tab],
  );
  const counts = {
    active: users.filter((u) => (u.status || "active") === "active").length,
    inactive: users.filter((u) => u.status === "inactive").length,
    invited: users.filter((u) => u.status === "invited").length,
    deleted: users.filter((u) => u.status === "deleted").length,
  };

  const setStatus = async (id: string, action: "activate" | "deactivate" | "delete") => {
    try {
      await api.users.setStatus(id, action);
      toast.success(`User ${action}d`);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {(["active", "inactive", "invited", "deleted"] as UserStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={
                "px-3 py-1.5 rounded-md text-xs font-medium capitalize flex items-center gap-1.5 " +
                (tab === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {s}
              {counts[s] > 0 && (
                <span
                  className={
                    "text-[10px] px-1.5 py-0.5 rounded-full " +
                    (tab === s ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground")
                  }
                >
                  {counts[s]}
                </span>
              )}
            </button>
          ))}
        </div>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus size={14} /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add new user</DialogTitle>
            </DialogHeader>
            <AddUserForm
              onSuccess={() => {
                setShowAdd(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between p-3 rounded-xl bg-card border hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-accent font-semibold text-sm">
                    {u.fullName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{u.fullName}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {roleLabel(u.role)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.phone && <p className="text-[11px] text-muted-foreground">{u.phone}</p>}
                  {u.zones?.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">Zones: {u.zones.join(", ")}</p>
                  )}
                </div>
              </div>

              {tab !== "deleted" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {tab === "active" && (
                      <>
                        <DropdownMenuItem onClick={() => setStatus(u.id, "deactivate")}>
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setStatus(u.id, "delete")}
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                    {(tab === "inactive" || tab === "invited") && (
                      <>
                        <DropdownMenuItem onClick={() => setStatus(u.id, "activate")}>
                          Activate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setStatus(u.id, "delete")}
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">No {tab} users</p>
          )}
        </div>
      )}
    </div>
  );
}
