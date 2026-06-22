import { useIdentityStore } from "@/lib/lead-identity/store";
import type { UnifiedLead } from "@/lib/lead-identity/types";
import { Button } from "@/components/ui/button";
import { Shield, UserPlus, Lock, Eye } from "lucide-react";
import { toast } from "sonner";

interface Props {
  lead: UnifiedLead;
  ownerName?: string;
  compact?: boolean;
}

export function OwnershipBadge({ lead, ownerName, compact }: Props) {
  const me = useIdentityStore((s) => s.currentUser);
  const requestAccess = useIdentityStore((s) => s.requestAccess);
  const isPrimary = lead.primaryOwnerId === me.id;
  const isSecondary = lead.secondaryOwnerId === me.id;
  const slotsFull = !!lead.secondaryOwnerId;

  const onRequest = () => {
    const r = requestAccess(lead.id);
    if (r) toast.success("Access request sent to owner");
    else toast.info("Already pending or you're the owner");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium border ${
        isPrimary ? "bg-primary/10 border-primary/30 text-primary"
        : isSecondary ? "bg-accent/10 border-accent/30 text-accent-foreground"
        : "bg-muted border-border text-muted-foreground"
      }`}>
        <Shield className="h-3 w-3" />
        {isPrimary ? "You · Primary" : `Owner: ${ownerName ?? lead.primaryOwnerId}`}
      </span>
      {lead.secondaryOwnerId && !compact && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-muted border border-border text-muted-foreground">
          +1 secondary
        </span>
      )}
      {!isPrimary && !isSecondary && (
        slotsFull ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-muted border border-border text-muted-foreground">
            <Lock className="h-3 w-3" /> Both slots taken - view only
          </span>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={onRequest}>
            <UserPlus className="h-3 w-3" /> Request access
          </Button>
        )
      )}
      {!isPrimary && !isSecondary && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Eye className="h-3 w-3" /> view-only
        </span>
      )}
    </div>
  );
}
