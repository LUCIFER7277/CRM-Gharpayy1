import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DirectLeadForm } from "@/components/leads/DirectLeadForm";
import { QuickAddLeadPanel } from "@/components/leads/QuickAddLeadPanel";
import { RequestAccessSheet } from "@/components/leads/RequestAccessSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useIdentityStore } from "@/lib/lead-identity/store";
import { Shield, Sparkles } from "lucide-react";

export const Route = createFileRoute("/leads/add")({
  head: () => ({
    meta: [
      { title: "Add Lead - Gharpayy" },
      { name: "description", content: "Direct entry with live dedup, zone detection, and one-click ownership." },
    ],
  }),
  component: AddLeadPage,
});

function AddLeadPage() {
  const totalLeads = useIdentityStore((s) => s.leads.length);
  const [quickAddOpen, setQuickAddOpen] = useState(true);
  return (
    <AppShell>
      <div className="space-y-4 max-w-3xl mx-auto">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Add a lead</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Real-time dedup against {totalLeads} unified leads
            </p>
          </div>
        </header>

        <Tabs defaultValue="quick" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quick">Quick Add</TabsTrigger>
            <TabsTrigger value="single">Single lead</TabsTrigger>
            <TabsTrigger value="geo">Geo-intelligence</TabsTrigger>
            <TabsTrigger value="requests">Access requests</TabsTrigger>
          </TabsList>
          <TabsContent value="quick">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Quick Add is the only paste flow
                </h2>
                <p className="text-sm text-muted-foreground">Paste into any Quick Add field and it auto-fills the same lead questions, dedups, and keeps geo data together.</p>
              </div>
              <Button onClick={() => setQuickAddOpen(true)} className="w-full">Open Quick Add</Button>
            </div>
          </TabsContent>
          <TabsContent value="single"><DirectLeadForm /></TabsContent>
          <TabsContent value="geo"><GeoIntelligenceGuide /></TabsContent>
          <TabsContent value="requests"><RequestAccessSheet /></TabsContent>
        </Tabs>
      </div>
      <QuickAddLeadPanel open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </AppShell>
  );
}

function GeoIntelligenceGuide() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Geo-intelligence sync</h2>
        <p className="text-sm text-muted-foreground">Every paste now keeps area tokens, map links, raw address, zone, and distance-readiness with the lead.</p>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="rounded-md bg-muted/40 p-3"><strong>Ready</strong> · map link or strong multi-area match is attached.</div>
        <div className="rounded-md bg-muted/40 p-3"><strong>Needs map link</strong> · area is parsed, exact travel distance can be added later.</div>
        <div className="rounded-md bg-muted/40 p-3"><strong>Needs location</strong> · lead can still be saved, but routing confidence is low.</div>
      </div>
    </div>
  );
}
