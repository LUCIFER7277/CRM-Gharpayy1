import { useMemo, useState } from "react";
import { useCRM10x } from "@/lib/crm10x/store";
import { renderTemplate, waLink, WA_TEMPLATES, type TemplateStage } from "@/lib/crm10x/templates";
import { useApp, getProperty } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, MessageSquare, Languages } from "lucide-react";
import { toast } from "sonner";

export function WaTemplatePicker({ lead }: { lead: Lead }) {
  const profile = useCRM10x((s) => s.profiles[lead.id]);
  const allTours = useApp((s) => s.tours);
  const properties = useApp((s) => s.properties);
  const tcms = useApp((s) => s.tcms);
  const sendMessage = useApp((s) => s.sendMessage);

  const [stage, setStage] = useState<TemplateStage>("follow-up");
  const [lang, setLang] = useState<"english" | "hindi">(
    profile?.language === "hindi" ? "hindi" : "english",
  );

  const tours = useMemo(() => allTours.filter((t) => t.leadId === lead.id), [allTours, lead.id]);
  const tour = tours[0];
  const prop = tour ? getProperty(tour.propertyId ?? undefined, properties) : undefined;
  const agent = tcms.find((t) => t.id === lead.assignedTcmId);

  const rendered = renderTemplate(stage, lang, {
    name: lead.name.split(" ")[0],
    agent: agent?.name ?? "Gharpayy",
    area: lead.preferredArea,
    budget: Math.round(lead.budget / 1000) + "k",
    property: prop?.name ?? "the property",
    date: tour ? new Date(tour.scheduledAt).toLocaleDateString() : "",
    time: tour
      ? new Date(tour.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "",
    price: prop?.pricePerBed ?? lead.budget,
    phone: lead.phone,
  });

  const sendNow = () => {
    window.open(waLink(lead.phone, rendered), "_blank", "noopener,noreferrer");
    sendMessage(lead.id, `[${WA_TEMPLATES[stage].label} · ${lang}] sent`);
    toast.success("WhatsApp opened with template");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold">
        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp templates
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={stage} onValueChange={(v) => setStage(v as TemplateStage)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WA_TEMPLATES).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={lang} onValueChange={(v) => setLang(v as "english" | "hindi")}>
          <SelectTrigger className="h-8 text-xs">
            <Languages className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="hindi">हिंदी</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Textarea readOnly value={rendered} rows={3} className="text-xs resize-none" />
      <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={sendNow}>
        <ExternalLink className="h-3 w-3" /> Open in WhatsApp
      </Button>
    </div>
  );
}
