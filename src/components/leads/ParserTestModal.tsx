// "Run Lead Parser Test" modal. Lets the operator either upload a CSV of raw
// pastes or run the built-in dataset, then renders a tight pass/fail report
// with downloadable failures so they can fix the parser quickly.
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Download, Play, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  runParserSuite, extractSamplesFromCsv, BUILTIN_SAMPLES,
  type ParserTestReport,
} from "@/lib/lead-identity/parser-test";
import { toast } from "sonner";

interface Props { open: boolean; onClose: () => void; }

export function ParserTestModal({ open, onClose }: Props) {
  const [report, setReport] = useState<ParserTestReport | null>(null);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runBuiltin = () => {
    setRunning(true);
    setTimeout(() => {
      setReport(runParserSuite(BUILTIN_SAMPLES));
      setRunning(false);
    }, 50);
  };

  const onFile = async (file: File) => {
    setRunning(true);
    try {
      const text = await file.text();
      const samples = extractSamplesFromCsv(text);
      if (samples.length === 0) {
        toast.error("No `rawText` column found in CSV");
        setRunning(false);
        return;
      }
      setReport(runParserSuite(samples));
    } catch (e) {
      toast.error(`Test failed: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const downloadFailed = () => {
    if (!report) return;
    const failed = report.rows.filter((r) => r.status === "failed");
    const csv = "index,reason,raw\n" + failed.map((r) =>
      `${r.index},"${(r.reason ?? "").replace(/"/g, '""')}","${r.raw.replace(/"/g, '""').replace(/\n/g, "\\n")}"`,
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `parser-failures-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" /> Lead Parser Test Suite
          </DialogTitle>
        </DialogHeader>

        {!report && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Run the parser against a CSV of raw pastes (must include a <code>rawText</code> column)
              or use the built-in real-world sample set.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={runBuiltin} disabled={running} className="gap-2">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run built-in suite ({BUILTIN_SAMPLES.length} samples)
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={running} className="gap-2">
                <Upload className="h-4 w-4" /> Upload CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {report && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Total" value={report.total} tone="neutral" />
              <Stat label="Parsed ✅" value={report.parsed} tone="good" />
              <Stat label="Failed ❌" value={report.failed} tone="bad" />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usable (contact only)</span>
                <span className="font-medium">{report.usable}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zone accuracy</span>
                <span className="font-medium">{report.zoneAccuracy}% <span className="text-[11px] text-muted-foreground">({report.zoneSample} sampled)</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Run time</span>
                <span className="font-medium">{report.durationMs} ms</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Missing fields</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(report.missing).map(([k, v]) => (
                  <Badge key={k} variant={v === 0 ? "secondary" : "destructive"} className="capitalize">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border max-h-56 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">#</th>
                    <th className="text-left px-2 py-1.5">Status</th>
                    <th className="text-left px-2 py-1.5">Name</th>
                    <th className="text-left px-2 py-1.5">Phone</th>
                    <th className="text-left px-2 py-1.5">Zone</th>
                    <th className="text-left px-2 py-1.5">Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.slice(0, 50).map((r) => (
                    <tr key={r.index} className="border-t border-border">
                      <td className="px-2 py-1 tabular-nums">{r.index + 1}</td>
                      <td className="px-2 py-1">
                        {r.status === "parsed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        {r.status === "usable" && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        {r.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      </td>
                      <td className="px-2 py-1 truncate max-w-32">{r.parsed?.name || "-"}</td>
                      <td className="px-2 py-1 tabular-nums">{r.parsed?.phone || "-"}</td>
                      <td className="px-2 py-1">{r.parsed?.zone || "-"}</td>
                      <td className="px-2 py-1 text-[10px] text-muted-foreground">{r.missing.join(", ") || "none"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length > 50 && (
                <div className="text-[10px] text-muted-foreground text-center py-1.5">+ {report.rows.length - 50} more rows</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {report && (
            <>
              <Button variant="outline" size="sm" onClick={() => setReport(null)}>Re-run</Button>
              <Button variant="outline" size="sm" onClick={downloadFailed} disabled={report.failed === 0} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download failed rows
              </Button>
            </>
          )}
          <Button size="sm" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "neutral" }) {
  const cls =
    tone === "good" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
    : tone === "bad" ? "border-destructive/30 bg-destructive/5 text-destructive"
    : "border-border bg-muted/30 text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
