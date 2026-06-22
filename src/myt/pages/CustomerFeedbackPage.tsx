import { useMemo, useState } from "react";
import { Link, useParams } from "@/shims/react-router-dom";
import { useAppState } from "@/myt/lib/app-context";
import { useTourData, type CustomerFeedback, type CustomerSentiment } from "@/myt/lib/tour-data-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OPTS: { v: CustomerSentiment; label: string; emoji: string }[] = [
  { v: "loved", label: "Loved it", emoji: "🔥" },
  { v: "good_unsure", label: "Good but unsure", emoji: "🙂" },
  { v: "not_fit", label: "Not a fit", emoji: "❌" },
  { v: "need_better", label: "Need better options", emoji: "🔄" },
];

export default function CustomerFeedbackPage() {
  const { id } = useParams();
  const { tours } = useAppState();
  const { feedback, setFeedback, addEvent } = useTourData();
  const tour = useMemo(() => tours.find((t) => t.id === id), [tours, id]);
  const existing = id ? feedback[id] : undefined;
  const [sentiment, setSentiment] = useState<CustomerSentiment | undefined>(existing?.sentiment);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [submitted, setSubmitted] = useState(!!existing);

  if (!tour) return <div className="p-6">Tour not found.</div>;

  function submit() {
    if (!sentiment || !id) {
      toast.error("Pick how the tour felt");
      return;
    }
    const f: CustomerFeedback = { tourId: id, sentiment, comment, at: new Date().toISOString() };
    setFeedback(f);
    addEvent({ tourId: id, kind: "feedback_received", notes: `${sentiment}${comment ? " · " + comment.slice(0, 80) : ""}` });
    setSubmitted(true);
    toast.success("Thanks for your feedback");
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <Link to={`/myt/tour/${tour.id}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to tour
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>How was your tour at {tour.propertyName}?</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hi {tour.leadName} - your feedback helps us refine your options.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {OPTS.map((o) => (
              <button
                key={o.v}
                onClick={() => setSentiment(o.v)}
                className={cn(
                  "rounded-lg border p-3 text-left hover:border-primary transition-colors",
                  sentiment === o.v && "border-primary bg-primary/5",
                )}
              >
                <div className="text-2xl">{o.emoji}</div>
                <div className="text-sm font-medium mt-1">{o.label}</div>
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="c">Tell us more (optional)</Label>
            <Textarea
              id="c"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Liked / disliked anything? Price, rooms, location?"
            />
          </div>

          <Button onClick={submit} disabled={!sentiment} className="w-full">
            {submitted ? "Update feedback" : "Submit feedback"}
          </Button>

          {submitted && (
            <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
              ✅ Recorded. The team will reach out with refined options shortly.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
