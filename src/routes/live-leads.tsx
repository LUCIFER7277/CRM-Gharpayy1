import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { useLiveLeads } from "@/hooks/useLiveLeads";
import { tokenStore } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadPasteParser } from "@/components/leads/LeadPasteParser";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { ChevronRight } from "lucide-react";
import type { Lead } from "@/contracts";

export const Route = createFileRoute("/live-leads")({
  head: () => ({ meta: [{ title: "Live Leads (Mongo)" }] }),
  component: () => <AppShell><LiveLeadsPage /></AppShell>,
});

function LiveLeadsPage() {
  const { leads, loading, error, createLead } = useLiveLeads();
  const [selected, setSelected] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!tokenStore.get()) {
    return (
      <Card className="m-6 p-6">
        <h2 className="text-lg font-semibold mb-2">Sign in required</h2>
        <p className="text-sm text-muted-foreground mb-4">This page talks to your VPS Node API. Sign in to get a JWT.</p>
        <Link to="/login" search={{ redirect: "/" }} className="text-primary underline">Go to login →</Link>
      </Card>
    );
  }

  const open = (l: Lead) => { setSelected(l); setDrawerOpen(true); };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">Live Leads <Badge variant="secondary">Mongo · Realtime</Badge></h1>
        <p className="text-sm text-muted-foreground">Click any lead to open the Salesforce-style drawer with timeline, tasks, and the full sales motion.</p>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="paste">Paste & parse</TabsTrigger>
        </TabsList>

        <TabsContent value="paste">
          <LeadPasteParser />
        </TabsContent>

        <TabsContent value="list">
          <Card className="p-2">
            {loading && <p className="text-xs text-muted-foreground p-3">Loading…</p>}
            {error && <p className="text-xs text-destructive p-3">{error}</p>}
            <div className="divide-y">
              {leads.map((l) => (
                <button
                  key={l._id}
                  type="button"
                  onClick={() => open(l)}
                  className="w-full text-left py-3 px-3 flex items-center justify-between hover:bg-muted/40 rounded-md transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.name} <span className="text-xs text-muted-foreground">· {l.phone}</span></div>
                    <div className="text-xs text-muted-foreground truncate">{l.preferredArea} · ₹{l.budget?.toLocaleString()} · move-in {l.moveInDate}</div>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    <Badge>{l.stage}</Badge>
                    <Badge variant="outline" className="capitalize">{l.intent}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
              {!loading && leads.length === 0 && (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">No leads yet.</p>
                  <Button variant="outline" size="sm" onClick={() => (document.querySelector('[role="tab"][value="paste"]') as HTMLElement | null)?.click()}>Add your first lead</Button>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <LeadDrawer
        lead={selected}
        open={drawerOpen}
        onOpenChange={(o) => { setDrawerOpen(o); if (!o) setSelected(null); }}
      />
    </div>
  );
}
