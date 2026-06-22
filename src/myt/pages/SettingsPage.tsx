import { useState } from "react";
import {
  useSettings,
  type MessageTemplate,
  type ScoreWeights,
  type CustomField,
  type CustomTarget,
  type MatchingSettings,
  type ZoneOrgUnit,
} from "@/myt/lib/settings-context";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Plus, RotateCcw, Trash2, Settings2, Sparkles, BellRing, MessageSquareText, Target,
  MapPin, Users, Building2, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { settings, update, reset, upsertTemplate, removeTemplate } = useSettings();

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">CRM Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Matching behavior, drawer behavior, messaging, reminders, scoring, custom fields and targets. Stored locally.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { reset(); toast.success("Settings reset"); }}>
          <RotateCcw className="mr-1 h-4 w-4" /> Reset all
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard icon={Sparkles} label="Top matches shown" value={String(settings.matching.topMatchCount)} sub="inside lead drawer" />
        <SummaryCard icon={Settings2} label="Default lead tab" value={settings.matching.drawerDefaultTab === "best-fit" ? "Best Fit" : "Control"} sub="when no active tour exists" />
        <SummaryCard icon={MessageSquareText} label="Templates" value={String(settings.templates.length)} sub="active WhatsApp flows" />
        <SummaryCard icon={Target} label="Targets" value={String(settings.targets.length)} sub="custom KPI rules" />
      </div>

      <Tabs defaultValue="matching" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4 xl:grid-cols-8">
          <TabsTrigger value="matching">Matching &amp; drawer</TabsTrigger>
          <TabsTrigger value="zones">Zones &amp; team</TabsTrigger>
          <TabsTrigger value="templates">Message templates</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="weights">Score weights</TabsTrigger>
          <TabsTrigger value="reminders">Reminder timing</TabsTrigger>
          <TabsTrigger value="custom">Custom fields &amp; lists</TabsTrigger>
          <TabsTrigger value="targets">Targets &amp; roadmap</TabsTrigger>
        </TabsList>

        <TabsContent value="matching" className="space-y-3">
          <MatchingEditor matching={settings.matching} onChange={(v) => update("matching", v)} />
        </TabsContent>

        <TabsContent value="matching" className="space-y-3">
          <MatchingEditor matching={settings.matching} onChange={(v) => update("matching", v)} />
        </TabsContent>

        <TabsContent value="zones" className="space-y-3">
          <ZonesEditor zones={settings.zones} onChange={(v) => update("zones", v)} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-3">
          {settings.templates.map((t) => (
            <TemplateEditor key={t.id} t={t} onSave={upsertTemplate} onDelete={() => removeTemplate(t.id)} />
          ))}
          <NewTemplate onAdd={upsertTemplate} />
        </TabsContent>

        <TabsContent value="branding">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <Label>Site name</Label>
                <Input value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} />
              </div>
              <div>
                <Label>Signature line</Label>
                <Input value={settings.signatureLine} onChange={(e) => update("signatureLine", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weights">
          <WeightsEditor weights={settings.weights} onChange={(w) => update("weights", w)} />
        </TabsContent>

        <TabsContent value="reminders">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <Label>Pre-tour reminder offsets (minutes before tour, comma-separated)</Label>
                <Input
                  value={settings.reminders.beforeTourMinutes.join(", ")}
                  onChange={(e) =>
                    update("reminders", {
                      ...settings.reminders,
                      beforeTourMinutes: e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite),
                    })
                  }
                />
              </div>
              <div>
                <Label>Post-booking follow-up if no reply (minutes, comma-separated)</Label>
                <Input
                  value={settings.reminders.postBookingFollowupMinutes.join(", ")}
                  onChange={(e) =>
                    update("reminders", {
                      ...settings.reminders,
                      postBookingFollowupMinutes: e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite),
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">These reminders are surfaced as execution timing in the CRM.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="space-y-3">
          <ListEditor title="Areas" items={settings.customAreas} onChange={(v) => update("customAreas", v)} placeholder="Koramangala" />
          <ListEditor title="Objection tags" items={settings.customObjections} onChange={(v) => update("customObjections", v)} placeholder="Too expensive" />
          <ListEditor title="Custom outcomes" items={settings.customOutcomes} onChange={(v) => update("customOutcomes", v)} placeholder="Token paid via UPI" />
          <PropertyEditor items={settings.customProperties} onChange={(v) => update("customProperties", v)} />
          <TcmEditor items={settings.customTcms} onChange={(v) => update("customTcms", v)} />
          <CustomFieldsEditor fields={settings.customFields} onChange={(v) => update("customFields", v)} />
        </TabsContent>

        <TabsContent value="targets" className="space-y-3">
          <TargetsEditor targets={settings.targets} onChange={(v) => update("targets", v)} />
          <RoadmapCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md border border-border bg-muted/40 p-2">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchingEditor({ matching, onChange }: { matching: MatchingSettings; onChange: (v: MatchingSettings) => void }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lead drawer behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Best-fit properties shown per lead</Label>
              <span className="font-medium">{matching.topMatchCount}</span>
            </div>
            <Slider
              value={[matching.topMatchCount]}
              onValueChange={([value]) => onChange({ ...matching, topMatchCount: value })}
              min={3}
              max={8}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Default tab when a lead opens and no active tour exists</Label>
            <select
              value={matching.drawerDefaultTab}
              onChange={(e) => onChange({ ...matching, drawerDefaultTab: e.target.value as MatchingSettings["drawerDefaultTab"] })}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="best-fit">Best Fit</option>
              <option value="control">Control</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SwitchRow
              label="Auto-expand top property"
              hint="Open the first match with more details right away."
              checked={matching.autoExpandTopMatch}
              onCheckedChange={(checked) => onChange({ ...matching, autoExpandTopMatch: checked })}
            />
            <SwitchRow
              label="Show score breakdown"
              hint="Expose area, budget, audience and quality signals."
              checked={matching.showScoreBreakdown}
              onCheckedChange={(checked) => onChange({ ...matching, showScoreBreakdown: checked })}
            />
            <SwitchRow
              label="Show amenities preview"
              hint="Keep quick amenities visible on collapsed cards."
              checked={matching.showAmenitiesPreview}
              onCheckedChange={(checked) => onChange({ ...matching, showAmenitiesPreview: checked })}
            />
            <SwitchRow
              label="Show manager contact actions"
              hint="Allow fast manager call and WhatsApp from the drawer."
              checked={matching.showManagerContacts}
              onCheckedChange={(checked) => onChange({ ...matching, showManagerContacts: checked })}
            />
            <SwitchRow
              label="Show maps CTA"
              hint="Expose property map links directly in Best Fit."
              checked={matching.showMapsAction}
              onCheckedChange={(checked) => onChange({ ...matching, showMapsAction: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What this changes live</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
            <div>Lead drawer now opens to <span className="font-medium text-foreground">{matching.drawerDefaultTab === "best-fit" ? "Best Fit" : "Control"}</span> when there is no live tour.</div>
          </div>
          <div className="flex items-start gap-2">
            <BellRing className="mt-0.5 h-4 w-4 text-accent" />
            <div>{matching.topMatchCount} ranked properties are surfaced per lead for faster pitching.</div>
          </div>
          <div className="flex items-start gap-2">
            <Settings2 className="mt-0.5 h-4 w-4 text-accent" />
            <div>Expanded property previews can include amenities, maps, manager contacts and score rationale.</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function TemplateEditor({ t, onSave, onDelete }: { t: MessageTemplate; onSave: (t: MessageTemplate) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState(t);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="max-w-xs font-medium" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { onSave(draft); toast.success("Saved"); }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input value={draft.scenario} onChange={(e) => setDraft({ ...draft, scenario: e.target.value })} placeholder="When to send" />
        <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6} className="font-mono text-xs" />
        <p className="text-[11px] text-muted-foreground">Variables: {"{{leadName}} {{propertyName}} {{area}} {{when}} {{tcmName}} {{tcmPhone}} {{budget}} {{workLocation}} {{mapsLink}} {{etaMinutes}} {{otp}} {{siteName}} {{signature}}"}</p>
      </CardContent>
    </Card>
  );
}

function NewTemplate({ onAdd }: { onAdd: (t: MessageTemplate) => void }) {
  const [draft, setDraft] = useState<MessageTemplate>({ id: "", label: "", scenario: "", body: "" });
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">+ Add new template</div>
        <Input placeholder="ID (e.g. weekend_special)" value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/\s+/g, "_") })} />
        <Input placeholder="Label" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        <Input placeholder="Scenario" value={draft.scenario} onChange={(e) => setDraft({ ...draft, scenario: e.target.value })} />
        <Textarea placeholder="Body with {{variables}}" rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        <Button size="sm" onClick={() => {
          if (!draft.id || !draft.label || !draft.body) return toast.error("ID, label and body required");
          onAdd(draft);
          setDraft({ id: "", label: "", scenario: "", body: "" });
          toast.success("Added");
        }}><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </CardContent>
    </Card>
  );
}

function WeightsEditor({ weights, onChange }: { weights: ScoreWeights; onChange: (w: ScoreWeights) => void }) {
  const total = Object.values(weights).reduce((s, n) => s + n, 0);
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="text-xs text-muted-foreground">Total weight: <b>{total}</b> (recommended ~100)</div>
        {(Object.keys(weights) as Array<keyof ScoreWeights>).map((k) => (
          <div key={k} className="grid grid-cols-3 items-center gap-2">
            <Label className="capitalize">{k.replace(/([A-Z])/g, " $1")}</Label>
            <Input type="number" value={weights[k]} onChange={(e) => onChange({ ...weights, [k]: parseInt(e.target.value, 10) || 0 })} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ListEditor({ title, items, onChange, placeholder }: { title: string; items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">{title}</div>
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
              {it}
              <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
          <Button size="sm" onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV(""); } }}>Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyEditor({ items, onChange }: { items: { id: string; name: string; area: string; basePrice: number }[]; onChange: (v: { id: string; name: string; area: string; basePrice: number }[]) => void }) {
  const [d, setD] = useState({ name: "", area: "", basePrice: 12000 });
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">Custom properties</div>
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border-b py-1 text-sm">
            <span className="flex-1">{p.name} <span className="text-muted-foreground">· {p.area} · ₹{p.basePrice.toLocaleString("en-IN")}</span></span>
            <button onClick={() => onChange(items.filter((x) => x.id !== p.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <Input placeholder="Area" value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })} />
          <Input type="number" placeholder="Base price" value={d.basePrice} onChange={(e) => setD({ ...d, basePrice: parseInt(e.target.value, 10) || 0 })} />
        </div>
        <Button size="sm" onClick={() => { if (!d.name) return; onChange([...items, { id: `cp${Date.now()}`, ...d }]); setD({ name: "", area: "", basePrice: 12000 }); }}>
          <Plus className="mr-1 h-4 w-4" /> Add property
        </Button>
      </CardContent>
    </Card>
  );
}

function TcmEditor({ items, onChange }: { items: { id: string; name: string; phone: string; zoneId: string }[]; onChange: (v: { id: string; name: string; phone: string; zoneId: string }[]) => void }) {
  const [d, setD] = useState({ name: "", phone: "", zoneId: "" });
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">Custom TCMs / coordinators</div>
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border-b py-1 text-sm">
            <span className="flex-1">{p.name} <span className="text-muted-foreground">· {p.phone} · zone {p.zoneId}</span></span>
            <button onClick={() => onChange(items.filter((x) => x.id !== p.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <Input placeholder="Phone" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
          <Input placeholder="Zone id" value={d.zoneId} onChange={(e) => setD({ ...d, zoneId: e.target.value })} />
        </div>
        <Button size="sm" onClick={() => { if (!d.name) return; onChange([...items, { id: `tcm${Date.now()}`, ...d }]); setD({ name: "", phone: "", zoneId: "" }); }}>
          <Plus className="mr-1 h-4 w-4" /> Add TCM
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomFieldsEditor({ fields, onChange }: { fields: CustomField[]; onChange: (v: CustomField[]) => void }) {
  const [d, setD] = useState<CustomField>({ id: "", label: "", type: "text", appliesTo: "tour" });
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">Custom fields</div>
        {fields.map((f) => (
          <div key={f.id} className="flex items-center gap-2 border-b py-1 text-sm">
            <span className="flex-1">{f.label} <span className="text-muted-foreground">· {f.type} · {f.appliesTo}</span></span>
            <button onClick={() => onChange(fields.filter((x) => x.id !== f.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2">
          <Input placeholder="Label" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
          <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as CustomField["type"] })} className="h-10 rounded border bg-background px-2 text-sm">
            <option value="text">text</option><option value="number">number</option><option value="select">select</option><option value="boolean">boolean</option>
          </select>
          <select value={d.appliesTo} onChange={(e) => setD({ ...d, appliesTo: e.target.value as CustomField["appliesTo"] })} className="h-10 rounded border bg-background px-2 text-sm">
            <option value="tour">tour</option><option value="property">property</option><option value="lead">lead</option>
          </select>
          <Button size="sm" onClick={() => { if (!d.label) return; onChange([...fields, { ...d, id: `f${Date.now()}` }]); setD({ id: "", label: "", type: "text", appliesTo: "tour" }); }}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetsEditor({ targets, onChange }: { targets: CustomTarget[]; onChange: (v: CustomTarget[]) => void }) {
  const [d, setD] = useState<CustomTarget>({ id: "", label: "", metric: "tours", scope: "global", value: 100, period: "week" });
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="text-sm font-medium">Custom targets</div>
        {targets.map((t) => (
          <div key={t.id} className="flex items-center gap-2 border-b py-1 text-sm">
            <span className="flex-1">{t.label}: {t.value} {t.metric}/{t.period} <span className="text-muted-foreground">· scope {t.scope}{t.scopeId ? ":" + t.scopeId : ""}</span></span>
            <button onClick={() => onChange(targets.filter((x) => x.id !== t.id))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Input placeholder="Label" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
          <select value={d.metric} onChange={(e) => setD({ ...d, metric: e.target.value as CustomTarget["metric"] })} className="h-10 rounded border bg-background px-2 text-sm">
            <option value="tours">tours</option><option value="showups">showups</option><option value="bookings">bookings</option><option value="score">score</option>
          </select>
          <select value={d.scope} onChange={(e) => setD({ ...d, scope: e.target.value as CustomTarget["scope"] })} className="h-10 rounded border bg-background px-2 text-sm">
            <option value="global">global</option><option value="tcm">tcm</option><option value="zone">zone</option><option value="property">property</option>
          </select>
          <Input placeholder="Scope id (optional)" value={d.scopeId ?? ""} onChange={(e) => setD({ ...d, scopeId: e.target.value })} />
          <Input type="number" value={d.value} onChange={(e) => setD({ ...d, value: parseInt(e.target.value, 10) || 0 })} />
          <select value={d.period} onChange={(e) => setD({ ...d, period: e.target.value as CustomTarget["period"] })} className="h-10 rounded border bg-background px-2 text-sm">
            <option value="day">day</option><option value="week">week</option><option value="month">month</option>
          </select>
        </div>
        <Button size="sm" onClick={() => { if (!d.label) return; onChange([...targets, { ...d, id: `tg${Date.now()}` }]); setD({ id: "", label: "", metric: "tours", scope: "global", value: 100, period: "week" }); }}>
          <Plus className="mr-1 h-4 w-4" /> Add target
        </Button>
      </CardContent>
    </Card>
  );
}

function ZonesEditor({ zones, onChange }: { zones: ZoneOrgUnit[]; onChange: (v: ZoneOrgUnit[]) => void }) {
  const { tcms } = useApp();
  const [draft, setDraft] = useState<ZoneOrgUnit>({ id: "", name: "", city: "Bangalore", flowOpsLeadName: "", flowOpsLeadPhone: "", tcmIds: [] });

  const upsert = (z: ZoneOrgUnit) => onChange(zones.map((x) => (x.id === z.id ? z : x)));
  const remove = (id: string) => onChange(zones.filter((x) => x.id !== id));
  const add = () => {
    const name = draft.name.trim();
    if (!name) return toast.error("Zone name required");
    const id = draft.id.trim() || `z-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    if (zones.some((x) => x.id === id)) return toast.error("Zone id exists");
    onChange([...zones, { ...draft, id, name }]);
    setDraft({ id: "", name: "", city: "Bangalore", flowOpsLeadName: "", flowOpsLeadPhone: "", tcmIds: [] });
    toast.success("Zone added");
  };

  const toggleTcm = (z: ZoneOrgUnit, tcmId: string) => {
    const tcmIds = z.tcmIds.includes(tcmId) ? z.tcmIds.filter((x) => x !== tcmId) : [...z.tcmIds, tcmId];
    upsert({ ...z, tcmIds });
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-accent" /> Org structure - Bangalore zones</CardTitle>
          <p className="text-xs text-muted-foreground">
            Each zone owns a Flow Ops lead and a roster of TCMs. Routing rule R04 uses this map to
            auto-assign new leads. Edit a zone or add a new one - changes apply immediately across
            the CRM.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {zones.map((z) => (
          <Card key={z.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <Input value={z.name} onChange={(e) => upsert({ ...z, name: e.target.value })} className="h-8 max-w-[200px] font-medium" />
                  <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{z.city}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(z.id)} className="h-7"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px]">Flow Ops lead</Label>
                  <Input value={z.flowOpsLeadName ?? ""} onChange={(e) => upsert({ ...z, flowOpsLeadName: e.target.value })} placeholder="Name" className="h-8" />
                </div>
                <div>
                  <Label className="text-[11px]">Phone</Label>
                  <Input value={z.flowOpsLeadPhone ?? ""} onChange={(e) => upsert({ ...z, flowOpsLeadPhone: e.target.value })} placeholder="9000010000" className="h-8" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] flex items-center gap-1"><Users className="h-3 w-3" /> TCMs in this zone</Label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {tcms.map((t) => {
                    const on = z.tcmIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTcm(z, t.id)}
                        className={
                          "rounded-full border px-2 py-0.5 text-[11px] transition " +
                          (on ? "border-accent bg-accent/15 text-accent" : "border-border bg-muted/20 text-muted-foreground hover:border-accent/40")
                        }
                      >
                        {t.name}
                      </button>
                    );
                  })}
                  {tcms.length === 0 && <span className="text-[11px] text-muted-foreground">No TCMs in store yet.</span>}
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Notes</Label>
                <Textarea value={z.notes ?? ""} onChange={(e) => upsert({ ...z, notes: e.target.value })} rows={2} className="text-xs" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">+ Add new zone</CardTitle></CardHeader>
        <CardContent className="grid gap-2 p-4 md:grid-cols-4">
          <Input placeholder="Zone name (e.g. HSR Layout)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Input placeholder="City" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <Input placeholder="Flow Ops lead name" value={draft.flowOpsLeadName ?? ""} onChange={(e) => setDraft({ ...draft, flowOpsLeadName: e.target.value })} />
          <Input placeholder="Lead phone" value={draft.flowOpsLeadPhone ?? ""} onChange={(e) => setDraft({ ...draft, flowOpsLeadPhone: e.target.value })} />
          <Button size="sm" onClick={add} className="md:col-span-4 md:w-fit"><Plus className="mr-1 h-4 w-4" /> Add zone</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RoadmapCard() {
  const items: { title: string; body: string }[] = [
    { title: "Zone P&L dashboard", body: "Per-zone bookings, conversion %, supply utilisation. Compare Koramangala vs Whitefield in one screen." },
    { title: "Flow-Ops daily standup view", body: "Auto-generated 8am brief: open leads, SLA breaches, top-3 hot rooms, TCMs at risk of missing target." },
    { title: "TCM mobile mode", body: "Compact, action-first UI for on-tour TCMs - start tour, capture feedback, request block, all in 3 taps." },
    { title: "Owner-facing pipeline", body: "Show each owner the count of qualified leads currently being pitched into their property - drives compliance." },
    { title: "PDF auto-attach over WhatsApp Cloud API", body: "Replace Drive deep-link with native PDF send via Meta WhatsApp Business API. Per-message audit trail." },
    { title: "Conversion learning loop", body: "Track which Plan A vs Plan B converted and feed back into matcher weights per zone, persona and budget band." },
    { title: "Lead scoring v2 with intent decay", body: "Decay confidence the longer a lead is unattended; auto-revive with Coach scripts at week 1, 2 and 4." },
    { title: "Bulk WhatsApp broadcast guardrails", body: "Throttle, dedupe and template-validate broadcasts so HR can run nudges without burning the customer relationship." },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="h-4 w-4 text-accent" /> What I recommend next</CardTitle>
        <p className="text-xs text-muted-foreground">
          Plan-of-record for the next iterations. Optimised for your zone-led org (Bangalore zones → Flow Ops lead → TCM roster). Items can be triaged here and converted into work.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="rounded-md border border-border bg-muted/10 p-3">
            <div className="text-sm font-medium text-foreground">{it.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{it.body}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
