import { useIdentityStore } from "@/lib/lead-identity/store";
import { Button } from "@/components/ui/button";
import { Inbox, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function RequestAccessSheet() {
  const me = useIdentityStore((s) => s.currentUser);
  const requests = useIdentityStore((s) => s.requests);
  const leads = useIdentityStore((s) => s.leads);
  const decideRequest = useIdentityStore((s) => s.decideRequest);

  const incoming = requests.filter((r) => r.toOwnerId === me.id && r.state === "pending");

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
        <Inbox className="h-4 w-4" /> Access requests
        {incoming.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">{incoming.length}</span>
        )}
      </h3>
      {incoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending access requests.</p>
      ) : (
        <div className="space-y-2">
          {incoming.map((r) => {
            const lead = leads.find((l) => l.id === r.id);
            return (
              <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.requesterName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    wants secondary access on {lead?.name ?? r.id.slice(0, 8)} ·{" "}
                    {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                    onClick={() => { decideRequest(r.id, "approved"); toast.success("Granted"); }}>
                    <Check className="h-3 w-3" /> Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1"
                    onClick={() => { decideRequest(r.id, "rejected"); toast.info("Rejected"); }}>
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
