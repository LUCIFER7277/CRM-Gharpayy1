// Lightweight in-process counters/histograms, exposed via /metrics in Prometheus
// text format. No prom-client dep needed for v1; swap in when scraping is wired.

type Counter = { type: "counter"; help: string; values: Map<string, number> };
type Histogram = { type: "histogram"; help: string; buckets: number[]; counts: Map<string, number[]>; sums: Map<string, number>; n: Map<string, number> };

const reg: Map<string, Counter | Histogram> = new Map();

function labelKey(labels?: Record<string, string>) {
  if (!labels) return "";
  return Object.keys(labels).sort().map((k) => `${k}="${labels[k]}"`).join(",");
}

export function counter(name: string, help: string) {
  let c = reg.get(name) as Counter | undefined;
  if (!c) {
    c = { type: "counter", help, values: new Map() };
    reg.set(name, c);
  }
  return {
    inc(labels?: Record<string, string>, n = 1) {
      const k = labelKey(labels);
      c!.values.set(k, (c!.values.get(k) ?? 0) + n);
    },
  };
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 200, 500, 1000, 2500, 5000];

export function histogram(name: string, help: string, buckets = DEFAULT_BUCKETS) {
  let h = reg.get(name) as Histogram | undefined;
  if (!h) {
    h = { type: "histogram", help, buckets, counts: new Map(), sums: new Map(), n: new Map() };
    reg.set(name, h);
  }
  return {
    observe(ms: number, labels?: Record<string, string>) {
      const k = labelKey(labels);
      const arr = h!.counts.get(k) ?? new Array(buckets.length).fill(0);
      for (let i = 0; i < buckets.length; i++) if (ms <= buckets[i]) arr[i]++;
      h!.counts.set(k, arr);
      h!.sums.set(k, (h!.sums.get(k) ?? 0) + ms);
      h!.n.set(k, (h!.n.get(k) ?? 0) + 1);
    },
  };
}

export function render(): string {
  const lines: string[] = [];
  for (const [name, m] of reg) {
    lines.push(`# HELP ${name} ${m.help}`);
    lines.push(`# TYPE ${name} ${m.type}`);
    if (m.type === "counter") {
      for (const [k, v] of m.values) {
        lines.push(`${name}${k ? `{${k}}` : ""} ${v}`);
      }
    } else {
      for (const [k, arr] of m.counts) {
        for (let i = 0; i < m.buckets.length; i++) {
          const labels = [k, `le="${m.buckets[i]}"`].filter(Boolean).join(",");
          lines.push(`${name}_bucket{${labels}} ${arr[i]}`);
        }
        const labels = [k, `le="+Inf"`].filter(Boolean).join(",");
        lines.push(`${name}_bucket{${labels}} ${m.n.get(k) ?? 0}`);
        lines.push(`${name}_sum${k ? `{${k}}` : ""} ${m.sums.get(k) ?? 0}`);
        lines.push(`${name}_count${k ? `{${k}}` : ""} ${m.n.get(k) ?? 0}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

// Pre-declared SLO counters
export const cmdCounter = counter("crm_commands_total", "Total commands handled");
export const cmdLatency = histogram("crm_command_latency_ms", "Command bus latency in ms");
export const eventCounter = counter("crm_events_total", "Total domain events emitted");
export const outboxLag = histogram("crm_outbox_lag_ms", "Outbox publish lag in ms", [10, 50, 100, 250, 500, 1000, 5000]);
export const workerJobs = counter("crm_worker_jobs_total", "Worker job outcomes");
