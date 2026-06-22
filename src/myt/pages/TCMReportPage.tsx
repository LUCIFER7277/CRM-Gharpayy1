import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useSettings } from "@/myt/lib/settings-context";
import { useTourData, type TCMReport } from "@/myt/lib/tour-data-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Field<T extends string> = { value: T; label: string };

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | undefined;
  onChange: (v: T) => void;
  options: Field<T>[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-2.5 py-1 rounded text-xs border",
            value === o.value
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border hover:border-primary/50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TCMReportPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { tours } = useAppState();
  const { settings } = useSettings();
  const { reports, setReport, addEvent } = useTourData();
  const tour = useMemo(() => tours.find((t) => t.id === id), [tours, id]);
  const existing = id ? reports[id] : undefined;

  const [r, setR] = useState<Partial<TCMReport>>(
    existing ?? {
      tourId: id ?? "",
      arrived: undefined,
      punctuality: undefined,
      budgetAlignment: undefined,
      propertyReaction: undefined,
      interestLevel: undefined,
      decisionAuthority: undefined,
      emotionalTone: undefined,
      outcome: undefined,
      nextStep: "",
    },
  );

  if (!tour) {
    return (
      <div className="p-6">
        <Link to="/myt/tours" className="text-primary underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p className="mt-3">Tour not found.</p>
      </div>
    );
  }

  function field<K extends keyof TCMReport>(k: K, v: TCMReport[K]) {
    setR((p) => ({ ...p, [k]: v }));
  }

  function canSubmit() {
    return (
      r.arrived &&
      r.punctuality &&
      r.budgetAlignment &&
      r.propertyReaction &&
      r.interestLevel &&
      r.decisionAuthority &&
      r.emotionalTone &&
      r.outcome &&
      r.nextStep &&
      r.nextStep.trim().length > 0
    );
  }

  function submit() {
    if (!canSubmit() || !id) {
      toast.error("Fill all required fields and define a next step");
      return;
    }
    const report: TCMReport = {
      tourId: id,
      arrived: r.arrived!,
      punctuality: r.punctuality!,
      budgetAlignment: r.budgetAlignment!,
      propertyReaction: r.propertyReaction!,
      interestLevel: r.interestLevel!,
      firstObjection: r.firstObjection,
      priceReactionWords: r.priceReactionWords,
      decisionAuthority: r.decisionAuthority!,
      comparisonReference: r.comparisonReference,
      emotionalTone: r.emotionalTone!,
      outcome: r.outcome!,
      nextStep: r.nextStep!,
      notes: r.notes,
      filedAt: new Date().toISOString(),
    };
    setReport(report);
    addEvent({ tourId: id, kind: "tcm_report_filed", notes: `Outcome: ${report.outcome}` });
    toast.success("Report filed - next task unlocked");
    nav(`/tour/${id}`);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link to={`/myt/tour/${tour.id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tour
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>TCM Intelligence Form - {tour.leadName}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Forced closure: you can't move on until every required field is filled. Your input is matched against the customer feedback to detect mismatches.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Arrived?</Label>
            <Pills
              value={r.arrived}
              onChange={(v) => field("arrived", v)}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "proxy", label: "Proxy visited" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Punctuality</Label>
            <Pills
              value={r.punctuality}
              onChange={(v) => field("punctuality", v)}
              options={[
                { value: "early", label: "Early" },
                { value: "on_time", label: "On time" },
                { value: "late", label: "Late" },
                { value: "no_show", label: "No-show" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Budget alignment</Label>
            <Pills
              value={r.budgetAlignment}
              onChange={(v) => field("budgetAlignment", v)}
              options={[
                { value: "exact", label: "Exact" },
                { value: "stretch", label: "Stretch" },
                { value: "mismatch", label: "Mismatch" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Property reaction</Label>
            <Pills
              value={r.propertyReaction}
              onChange={(v) => field("propertyReaction", v)}
              options={[
                { value: "positive", label: "Positive" },
                { value: "neutral", label: "Neutral" },
                { value: "negative", label: "Negative" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Interest level</Label>
            <Pills
              value={r.interestLevel}
              onChange={(v) => field("interestLevel", v)}
              options={[
                { value: "high", label: "🔥 High" },
                { value: "medium", label: "🙂 Medium" },
                { value: "low", label: "❄️ Low" },
              ]}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>First objection raised</Label>
              <select
                value={r.firstObjection ?? ""}
                onChange={(e) => field("firstObjection", e.target.value)}
                className="w-full h-10 mt-1 bg-background border border-border rounded-md px-3 text-sm"
              >
                <option value="">Select…</option>
                {settings.customObjections.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Price reaction (exact words)</Label>
              <Input
                className="mt-1"
                value={r.priceReactionWords ?? ""}
                onChange={(e) => field("priceReactionWords", e.target.value)}
                placeholder="e.g. 'Bahut zyada hai bhai'"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Decision authority</Label>
            <Pills
              value={r.decisionAuthority}
              onChange={(v) => field("decisionAuthority", v)}
              options={[
                { value: "self", label: "Self" },
                { value: "parent", label: "Parent" },
                { value: "group", label: "Group" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div>
            <Label>Comparison reference</Label>
            <Input
              className="mt-1"
              value={r.comparisonReference ?? ""}
              onChange={(e) => field("comparisonReference", e.target.value)}
              placeholder="e.g. 'They mentioned Stanza Living near campus'"
            />
          </div>

          <div className="space-y-2">
            <Label>Emotional tone</Label>
            <Pills
              value={r.emotionalTone}
              onChange={(v) => field("emotionalTone", v)}
              options={[
                { value: "excited", label: "Excited" },
                { value: "confused", label: "Confused" },
                { value: "defensive", label: "Defensive" },
                { value: "neutral", label: "Neutral" },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>Outcome (funnel position)</Label>
            <Pills
              value={r.outcome}
              onChange={(v) => field("outcome", v)}
              options={[
                { value: "booked", label: "Booked (token / blocked)" },
                { value: "hot", label: "Hot (24-48 hrs)" },
                { value: "warm", label: "Warm (exploring)" },
                { value: "cold", label: "Cold" },
                { value: "dropped", label: "Dropped" },
              ]}
            />
          </div>

          <div>
            <Label>Next step (mandatory)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              value={r.nextStep ?? ""}
              onChange={(e) => field("nextStep", e.target.value)}
              placeholder="e.g. Follow-up call tomorrow 11am · suggest property X · drop"
            />
          </div>

          <div>
            <Label>Free notes</Label>
            <Textarea
              className="mt-1"
              rows={3}
              value={r.notes ?? ""}
              onChange={(e) => field("notes", e.target.value)}
              placeholder="Anything else worth capturing"
            />
          </div>

          <Button onClick={submit} disabled={!canSubmit()} className="w-full">
            <Save className="h-4 w-4 mr-2" /> File report & unlock next task
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
