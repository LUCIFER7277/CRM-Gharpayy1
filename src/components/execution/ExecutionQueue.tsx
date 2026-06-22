import { useMemo, useState } from "react";
import { useLeads } from "@/hooks/api/useLeads";
import type { UnifiedLead } from "@/lib/lead-identity/types";
import { computeNextAction, breachState } from "@/lib/crm10x/execution-engine";
import { NextActionCard } from "./NextActionCard";
import { useNow } from "@/hooks/use-now";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Flame } from "lucide-react";

const DAY = 24 * 60 * 60 * 1000;

export function ExecutionQueue() {
  const { data: leadsArray = [] } = useLeads();
  const leads = leadsArray as unknown as UnifiedLead[];
  const now = useNow(30_000);
  const nowDate = now ? new Date(now) : new Date();
  const [q, setQ] = useState("");

  const enriched = useMemo(() => leads.map((l) => {
    const action = computeNextAction(l, nowDate);
    const breach = breachState(l, nowDate);
    return { lead: l, action, breach };
  }).filter((x) => x.action), [leads, nowDate]);

  const filtered = q
    ? enriched.filter((e) => e.lead.name.toLowerCase().includes(q.toLowerCase()))
    : enriched;

  const dueNow = filtered.filter((e) => e.breach !== "ok");
  const today = filtered.filter((e) => +new Date(e.action!.dueAt) <= +nowDate + DAY && e.breach === "ok");
  const tomorrow = filtered.filter((e) => {
    const due = +new Date(e.action!.dueAt);
    return due > +nowDate + DAY && due <= +nowDate + 2 * DAY;
  });
  const breached = filtered.filter((e) => e.breach === "breached" || e.breach === "escalated");
  const cold = filtered.filter((e) => e.action!.phase === 4);

  // 15-min law countdown — newest NEW lead with no contact
  const fifteenMinLeads = enriched.filter((e) =>
    !e.lead.lastContactAt && +nowDate - +new Date(e.lead.createdAt) < 15 * 60 * 1000);

  return (
    <div className="space-y-4 p-4 max-w-4xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Execution Queue</h1>
        <p className="text-sm text-muted-foreground">
          Date-anchored next actions. Every lead has exactly one next move — execute on schedule.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1"><Clock className="size-3" />{filtered.length} actions</Badge>
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" />{breached.length} breached</Badge>
          {fifteenMinLeads.length > 0 && (
            <Badge className="gap-1 bg-orange-500"><Flame className="size-3" />{fifteenMinLeads.length} in 15-min law</Badge>
          )}
        </div>
      </header>

      <Input
        placeholder="Search leads…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">Due now ({dueNow.length})</TabsTrigger>
          <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
          <TabsTrigger value="tomorrow">Tomorrow ({tomorrow.length})</TabsTrigger>
          <TabsTrigger value="breached">Breached ({breached.length})</TabsTrigger>
          <TabsTrigger value="cold">Cold drip ({cold.length})</TabsTrigger>
        </TabsList>
        {(["due", "today", "tomorrow", "breached", "cold"] as const).map((key) => {
          const list = ({ due: dueNow, today, tomorrow, breached, cold } as const)[key];
          return (
            <TabsContent key={key} value={key} className="space-y-3 mt-4">
              {list.length === 0 && (
                <Card className="p-6 text-sm text-muted-foreground text-center">Nothing here.</Card>
              )}
              {list.map((e) => (
                <div key={e.lead.id} className="space-y-1">
                  <div className="text-sm font-medium px-1 flex items-center justify-between">
                    <span>{e.lead.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {e.lead.area} · {e.lead.phoneRaw || e.lead.phoneE164}
                    </span>
                  </div>
                  <NextActionCard lead={e.lead} />
                </div>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
