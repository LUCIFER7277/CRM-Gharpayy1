import type { AdminLeadRow } from "./selectors";

const DAY = 86_400_000;

export interface MoneyMap {
  bookedRevenue: number;
  pipelineRevenue: number;
  walkingRevenue: number;
  atRiskRevenue: number;
  hotRevenue: number;
}

export function computeMoneyMap(rows: AdminLeadRow[]): MoneyMap {
  const now = Date.now();
  let booked = 0, pipeline = 0, walking = 0, atRisk = 0, hot = 0;
  for (const r of rows) {
    const annual = (r.bookings[0]?.amount ?? r.lead.budget) * 12;
    if (r.booked) booked += annual;
    else if (r.status === "lost") {
      if (now - r.lastTouchTs <= 30 * DAY) walking += r.lead.budget * 12;
    } else {
      pipeline += r.expectedValue;
      if (r.probability >= 70) hot += r.expectedValue;
      const stale = now - r.lastTouchTs > 3 * DAY;
      if (stale) atRisk += r.expectedValue;
    }
  }
  return { bookedRevenue: booked, pipelineRevenue: pipeline, walkingRevenue: walking, atRiskRevenue: atRisk, hotRevenue: hot };
}

export interface TcmHealth {
  tcmId: string;
  name: string;
  open: number;
  hot: number;
  dormant: number;
  booked: number;
  lost: number;
  conversion: number;
  pipelineValue: number;
  avgAgeDays: number;
  loadScore: number;
  riskFlag: "ok" | "watch" | "burn";
}

export function computeTcmHealth(rows: AdminLeadRow[]): TcmHealth[] {
  const now = Date.now();
  const by = new Map<string, AdminLeadRow[]>();
  rows.forEach((r) => {
    const id = r.lead.assignedTcmId;
    if (!id) return;
    (by.get(id) ?? by.set(id, []).get(id)!).push(r);
  });
  const out: TcmHealth[] = [];
  by.forEach((rs, id) => {
    const open = rs.filter((r) => r.status === "open").length;
    const hot = rs.filter((r) => r.probability >= 70 && !r.booked).length;
    const dormant = rs.filter((r) => r.status === "dormant").length;
    const booked = rs.filter((r) => r.booked).length;
    const lost = rs.filter((r) => r.status === "lost").length;
    const pipelineValue = rs.reduce((s, r) => s + r.expectedValue, 0);
    const ages = rs.filter((r) => !r.booked && r.status !== "lost").map((r) => (now - r.lastTouchTs) / DAY);
    const avgAgeDays = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const conversion = booked + lost ? booked / (booked + lost) : 0;
    const loadScore = Math.min(100, open * 4 + dormant * 2);
    const riskFlag: TcmHealth["riskFlag"] =
      loadScore > 80 || dormant > 8 ? "burn" :
      loadScore > 55 || dormant > 4 ? "watch" : "ok";
    out.push({
      tcmId: id, name: rs[0].tcm?.name ?? id,
      open, hot, dormant, booked, lost, conversion, pipelineValue, avgAgeDays, loadScore, riskFlag,
    });
  });
  return out.sort((a, b) => b.pipelineValue - a.pipelineValue);
}

export interface AreaPulse {
  area: string;
  leads: number;
  booked: number;
  hot: number;
  lostRate: number;
  revenue: number;
  topObjection: string;
}

export function computeAreaPulse(rows: AdminLeadRow[]): AreaPulse[] {
  const by = new Map<string, AdminLeadRow[]>();
  rows.forEach((r) => {
    const area = r.lead.preferredArea || "Unknown";
    (by.get(area) ?? by.set(area, []).get(area)!).push(r);
  });
  const out: AreaPulse[] = [];
  by.forEach((rs, area) => {
    const booked = rs.filter((r) => r.booked).length;
    const lost = rs.filter((r) => r.status === "lost").length;
    const hot = rs.filter((r) => r.probability >= 70 && !r.booked).length;
    const revenue = rs.reduce((s, r) => s + (r.booked ? (r.bookings[0]?.amount ?? r.lead.budget) * 12 : 0), 0);
    const objs = new Map<string, number>();
    rs.forEach((r) => r.objections.filter((o) => o.code !== "none").forEach((o) => objs.set(o.code, (objs.get(o.code) ?? 0) + 1)));
    const topObjection = [...objs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "\u2014";
    out.push({
      area, leads: rs.length, booked, hot,
      lostRate: rs.length ? lost / rs.length : 0,
      revenue, topObjection,
    });
  });
  return out.sort((a, b) => b.leads - a.leads);
}

export interface SourceROI {
  source: string;
  leads: number;
  booked: number;
  cvr: number;
  revenue: number;
  avgBudget: number;
}

export function computeSourceROI(rows: AdminLeadRow[]): SourceROI[] {
  const by = new Map<string, AdminLeadRow[]>();
  rows.forEach((r) => {
    const s = r.lead.source || "unknown";
    (by.get(s) ?? by.set(s, []).get(s)!).push(r);
  });
  const out: SourceROI[] = [];
  by.forEach((rs, source) => {
    const booked = rs.filter((r) => r.booked).length;
    const revenue = rs.reduce((s, r) => s + (r.booked ? (r.bookings[0]?.amount ?? r.lead.budget) * 12 : 0), 0);
    const avgBudget = Math.round(rs.reduce((s, r) => s + (r.lead.budget || 0), 0) / Math.max(1, rs.length));
    out.push({ source, leads: rs.length, booked, cvr: rs.length ? booked / rs.length : 0, revenue, avgBudget });
  });
  return out.sort((a, b) => b.revenue - a.revenue);
}

export interface VoiceQuote {
  leadId: string;
  leadName: string;
  text: string;
  sentiment: "negative" | "neutral" | "positive";
  ts: number;
}

export function collectVoiceOfCustomer(rows: AdminLeadRow[], limit = 12): VoiceQuote[] {
  const quotes: VoiceQuote[] = [];
  rows.forEach((r) => {
    r.objections.forEach((o) => {
      if (!o.leadWords || o.code === "none") return;
      quotes.push({
        leadId: r.lead.id, leadName: r.lead.name, text: o.leadWords,
        sentiment: o.resolution === "yes" ? "neutral" : "negative",
        ts: +new Date(o.ts),
      });
    });
    r.visits.forEach((v) => {
      if (v.lostReason) quotes.push({ leadId: r.lead.id, leadName: r.lead.name, text: String(v.lostReason), sentiment: "negative", ts: v.completedAt ?? v.scheduledAt });
    });
  });
  return quotes.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export interface SlaBreach {
  leadId: string;
  leadName: string;
  tcm: string;
  type: "first-response" | "post-tour" | "follow-up";
  ageHrs: number;
  probability: number;
  expectedValue: number;
}

export function computeSlaBreaches(rows: AdminLeadRow[]): SlaBreach[] {
  const now = Date.now();
  const out: SlaBreach[] = [];
  rows.forEach((r) => {
    if (r.booked || r.status === "lost") return;
    const ageHrs = (now - r.lastTouchTs) / 3_600_000;
    if (r.lead.stage === "new" && ageHrs > 1) {
      out.push({ leadId: r.lead.id, leadName: r.lead.name, tcm: r.tcm?.name ?? "\u2014", type: "first-response", ageHrs, probability: r.probability, expectedValue: r.expectedValue });
    } else if (r.lead.stage === "tour-done" && ageHrs > 24) {
      out.push({ leadId: r.lead.id, leadName: r.lead.name, tcm: r.tcm?.name ?? "\u2014", type: "post-tour", ageHrs, probability: r.probability, expectedValue: r.expectedValue });
    } else if (r.followUps.some((f) => !f.done && +new Date(f.dueAt) < now)) {
      out.push({ leadId: r.lead.id, leadName: r.lead.name, tcm: r.tcm?.name ?? "\u2014", type: "follow-up", ageHrs, probability: r.probability, expectedValue: r.expectedValue });
    }
  });
  return out.sort((a, b) => b.expectedValue - a.expectedValue).slice(0, 25);
}
