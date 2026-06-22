import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAuditLog, formatDiff } from "@/lib/crm10x/audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";
import { downloadCsv, downloadJson } from "@/admin/lib/exporters/csv";
import { useAuthUser } from "@/lib/auth-store";

export const Route = createFileRoute("/admin/audit")(
  {
    beforeLoad: () => {
      const role = useAuthUser.getState().user?.role;
      if (role !== "super_admin") throw redirect({ to: "/" });
    },
    component: AdminAudit,
  }
);

function AdminAudit() {
  const entries = useAuditLog((s) => s.entries);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.actorName.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const exportData = useMemo(
    () =>
      filtered.map((e) => ({
        time: new Date(e.ts).toLocaleString("en-IN"),
        actor: e.actorName,
        entity: `${e.entityType} #${e.entityId.slice(0, 8)}`,
        action: e.action,
        summary: e.summary,
        before: e.before != null ? String(e.before) : "",
        after: e.after != null ? String(e.after) : "",
      })),
    [filtered],
  );

  return (
    <AdminShell title="Audit Log" sub="Every admin action, recorded">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by actor, entity, or summary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(`audit-log-${Date.now()}.csv`, exportData)}
            >
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadJson(`audit-log-${Date.now()}.json`, exportData)}
            >
              <Download className="h-3 w-3 mr-1" />
              JSON
            </Button>
          </div>

          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-2 py-1.5 font-medium">Time</th>
                  <th className="text-left px-2 py-1.5 font-medium">Actor</th>
                  <th className="text-left px-2 py-1.5 font-medium">Entity</th>
                  <th className="text-left px-2 py-1.5 font-medium">Action</th>
                  <th className="text-left px-2 py-1.5 font-medium">Summary</th>
                  <th className="text-left px-2 py-1.5 font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                      {new Date(e.ts).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-2 py-1.5">{e.actorName}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">
                      {e.entityType} <span className="font-mono">#{e.entityId.slice(0, 8)}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <code className="bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">{e.action}</code>
                    </td>
                    <td className="px-2 py-1.5 max-w-xs truncate">{e.summary}</td>
                    <td className="px-2 py-1.5 text-muted-foreground font-mono text-[10px]">
                      {formatDiff(e.before, e.after) || "\u2014"}
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                      {search ? "No matching entries." : "No audit entries yet. Actions taken in Master Lead Console will appear here."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 500 && (
            <div className="text-[10px] text-muted-foreground text-center mt-2">
              Showing 500 of {filtered.length} entries. Export to CSV/JSON for full data.
            </div>
          )}
        </div>
      </AdminShell>
  );
}
