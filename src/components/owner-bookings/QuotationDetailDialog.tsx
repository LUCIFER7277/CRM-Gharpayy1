import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, IndianRupee, Calendar, Home, Hash, Lock, Bell, Wrench } from "lucide-react";
import type { Quotation } from "@/lib/crm10x/quotations";
import { formatINR } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  sent: "bg-accent/15 text-accent border-accent/30",
  paid: "bg-success/15 text-success border-success/30",
  "not-paid": "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface Props {
  quotation: Quotation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuotationDetailDialog({ quotation: q, open, onOpenChange }: Props) {
  if (!q) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-amber-500" />
            Quotation Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{q.propertyName}</div>
              <div className="text-xs text-muted-foreground">{q.roomType}{q.roomNumber ? ` · Room ${q.roomNumber}` : ""}</div>
            </div>
            <Badge variant="outline" className={`text-[10px] capitalize ${STATUS_TONE[q.status]}`}>
              {q.status}
            </Badge>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <DetailRow icon={<IndianRupee className="h-3 w-3" />} label="Actual Rent" value={formatINR(q.actualRent)} />
            <DetailRow icon={<IndianRupee className="h-3 w-3" />} label="Discounted Price" value={formatINR(q.discountedPrice)} tone={q.discountedPrice < q.actualRent ? "good" : undefined} />
            <DetailRow icon={<IndianRupee className="h-3 w-3" />} label="Deposit" value={formatINR(q.deposit)} />
            <DetailRow icon={<IndianRupee className="h-3 w-3" />} label="Prebook Amount" value={formatINR(q.prebook)} />
            <DetailRow icon={<Wrench className="h-3 w-3" />} label="Maintenance" value={`${formatINR(q.maintenance)} (${q.maintenanceType})`} />
            <DetailRow icon={<Lock className="h-3 w-3" />} label="Lock-in" value={q.lockIn} />
            <DetailRow icon={<Bell className="h-3 w-3" />} label="Notice" value={q.notice} />
            <DetailRow icon={<Hash className="h-3 w-3" />} label="Room" value={q.roomNumber || "—"} />
            <DetailRow icon={<Home className="h-3 w-3" />} label="Property ID" value={q.propertyId || "—"} />
            <DetailRow icon={<Calendar className="h-3 w-3" />} label="Sent" value={new Date(q.sentAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          </div>

          <Separator />

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              WhatsApp Message Preview
            </div>
            <div className="rounded-lg p-3" style={{ background: "#075E54" }}>
              <div
                className="rounded-xl px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words font-mono"
                style={{ background: "#DCF8C6", color: "#111", borderRadius: "12px 12px 2px 12px" }}
              >
                {q.message}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "warn" }) {
  const toneCls = tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className={`ml-auto font-medium ${toneCls}`}>{value}</span>
    </div>
  );
}
