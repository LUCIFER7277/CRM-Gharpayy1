import { getDb, col } from "../../db/mongo.js";

// Same rules as frontend engine
export const SLA = {
  firstResponseMins: 5,
  followUpHours: 24,
  postTourHours: 1,
  postTourAlertHours: 2,
  postTourEscalateHours: 6,
  reassignDays: 3,
};

function intentBoost(i: string) {
  return i === "hot" ? 50 : i === "warm" ? 20 : 0;
}

function intentFor(confidence: number) {
  if (confidence >= 75) return "hot";
  if (confidence >= 50) return "warm";
  return "cold";
}

function liveConfidence(lead: any, tours: any[], now: number): number {
  let s = lead.confidence || 0;
  const silentHrs = (now - +new Date(lead.updatedAt || lead.createdAt)) / 36e5;
  if (silentHrs > 6) s -= Math.min(20, Math.floor(silentHrs - 6));
  if (!lead.nextFollowUpAt) s -= 5;
  if (lead.responseSpeedMins <= 5) s += 5;
  else if (lead.responseSpeedMins > 15) s -= 4;

  const moveInStr = lead.moveInDate || lead.meta?.moveInDate;
  if (moveInStr) {
    const days = (+new Date(moveInStr) - now) / (24 * 36e5);
    if (days < 0) s -= 8;
    else if (days <= 3) s += 6;
    else if (days >= 14) s -= 3;
  }

  if (tours.some((t) => t.leadId === lead._id.toString() && t.status === "completed")) s += 8;
  if (tours.some((t) => t.leadId === lead._id.toString() && t.postTour?.outcome === "booked")) s = 100;
  if (lead.stage === "dropped") s = Math.min(s, 15);
  if (lead.stage === "booked") s = 100;

  return Math.max(0, Math.min(100, Math.round(s)));
}

function formatRel(mins: number): string {
  if (mins < 1) return "now";
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = mins / 60;
  if (h < 24) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  return `${Math.round(h / 24)}d`;
}

function sameDay(a: number, b: number) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function isLeadActive(l: any) {
  return l.stage !== "dropped" && l.stage !== "booked";
}

export function buildDoNextQueue(leads: any[], tours: any[], followUps: any[], now: number, filterTcmId?: string) {
  const actions: any[] = [];
  const byLead = (l: any) => !filterTcmId || l.assignedTcmId === filterTcmId;

  // 1. post-tour pending
  tours.filter(t => t.status === "completed" && !(t.postTour?.filledAt)).forEach(t => {
    const lead = leads.find(l => l._id.toString() === t.leadId);
    if (!lead || !byLead(lead) || !isLeadActive(lead)) return;
    const ts = t.scheduledAt ? +new Date(t.scheduledAt) : now;
    const hrs = Math.max(0, (now - ts) / 36e5) || 0;
    actions.push({
      leadId: lead._id.toString(),
      reason: `Post-tour form pending · ${Math.max(1, Math.round(hrs))}h overdue`,
      kind: "post-tour-overdue",
      score: 1000 + Math.min(100, hrs * 5),
    });
  });

  // 2. overdue follow-ups
  followUps.filter(f => !f.done && f.dueAt && +new Date(f.dueAt) < now).forEach(f => {
    const lead = leads.find(l => l._id.toString() === f.leadId);
    if (!lead || !byLead(lead) || !isLeadActive(lead)) return;
    const ts = f.dueAt ? +new Date(f.dueAt) : now;
    const hrs = Math.max(0, (now - ts) / 36e5) || 0;
    const intent = intentFor(liveConfidence(lead, tours, now));
    actions.push({
      leadId: lead._id.toString(),
      reason: `Follow-up overdue · ${f.reason}`,
      kind: "follow-up-overdue",
      score: 800 + Math.min(150, hrs * 2) + intentBoost(intent),
      dueAt: f.dueAt,
    });
  });

  // 3. tours scheduled today
  tours.filter(t => t.status === "scheduled" && t.scheduledAt && sameDay(+new Date(t.scheduledAt), now)).forEach(t => {
    const lead = leads.find(l => l._id.toString() === t.leadId);
    if (!lead || !byLead(lead) || !isLeadActive(lead)) return;
    const ts = t.scheduledAt ? +new Date(t.scheduledAt) : now;
    const minsToTour = (ts - now) / 60_000 || 0;
    const intent = intentFor(liveConfidence(lead, tours, now));
    actions.push({
      leadId: lead._id.toString(),
      reason: minsToTour > 0 ? `Tour today in ${formatRel(minsToTour)}` : `Tour was ${formatRel(-minsToTour)} ago - confirm`,
      kind: "tour-today",
      score: 700 + intentBoost(intent) - (Math.abs(minsToTour) / 30 || 0),
      dueAt: t.scheduledAt,
    });
  });

  // 4. follow-ups due today
  followUps.filter(f => !f.done && f.dueAt && sameDay(+new Date(f.dueAt), now) && +new Date(f.dueAt) >= now).forEach(f => {
    const lead = leads.find(l => l._id.toString() === f.leadId);
    if (!lead || !byLead(lead) || !isLeadActive(lead)) return;
    const intent = intentFor(liveConfidence(lead, tours, now));
    actions.push({
      leadId: lead._id.toString(),
      reason: `Follow-up today · ${f.reason}`,
      kind: "follow-up-today",
      score: 500 + intentBoost(intent),
      dueAt: f.dueAt,
    });
  });

  // 5. leads without any follow-up scheduled
  leads.filter(l => byLead(l) && !l.nextFollowUpAt && isLeadActive(l)).forEach(l => {
    const intent = intentFor(liveConfidence(l, tours, now));
    actions.push({
      leadId: l._id.toString(),
      reason: `No follow-up set · SLA breach`,
      kind: "no-follow-up",
      score: 600 + intentBoost(intent),
    });
  });

  // 6. brand-new leads waiting for first response
  leads.filter(l => byLead(l) && isLeadActive(l) && l.stage === "new").forEach(l => {
    const ts = l.createdAt ? +new Date(l.createdAt) : now;
    const ageMin = Math.max(0, (now - ts) / 60_000) || 0;
    if (ageMin > SLA.firstResponseMins) {
      actions.push({
        leadId: l._id.toString(),
        reason: `First response overdue · created ${formatRel(ageMin)} ago`,
        kind: "first-response",
        score: 900 + Math.min(100, ageMin / 5),
      });
    }
  });

  const seen = new Set<string>();
  return actions
    .sort((a, b) => b.score - a.score || a.leadId.localeCompare(b.leadId))
    .filter(a => {
      const k = `${a.leadId}:${a.kind}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// Service Methods for the API
export async function getArenaHomeData(tenantId: string, role: string, userId: string) {
  const now = Date.now();
  const filterTcmId = role === "tcm" ? userId : undefined;

  // We fetch a simplified set of records for active work
  const [leads, tours, followUps] = await Promise.all([
    col("leads").find({ tenantId }).toArray(), // Fetching all leads for chart data, maybe limit later
    col("tours").find({ tenantId }).toArray(),
    col("follow_ups").find({ tenantId, done: false }).toArray(),
  ]);

  // Compute liveLeads and hot items
  const queue = buildDoNextQueue(leads, tours, followUps, now, filterTcmId);
  const hotItems = queue.filter(a => {
    const lead = leads.find(l => l._id.toString() === a.leadId);
    if (!lead || !isLeadActive(lead)) return false;
    return intentFor(liveConfidence(lead, tours, now)) === "hot";
  });

  const incompleteTours = tours.filter(t => t.status === "completed" && !(t.postTour?.filledAt));
  const todayTours = tours.filter(t => t.status === "scheduled" && t.scheduledAt && sameDay(+new Date(t.scheduledAt), now));
  
  const bookedTours = tours.filter(t => t.postTour?.outcome === "booked");
  const booked = bookedTours.length;
  const conversion = tours.length ? Math.round((booked / tours.length) * 100) : 0;
  const overdueFu = followUps.filter(f => !f.done && f.dueAt && +new Date(f.dueAt) < now).length;
  
  let monthlyRevenue = 0;
  bookedTours.forEach(t => {
    const l = leads.find(lead => lead._id.toString() === t.leadId);
    monthlyRevenue += l?.budget || 0;
  });

  const chartData = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let i = 14; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = +d;
    const dayEnd = dayStart + 24 * 3600_000;
    const dayLeads = leads.filter(l => +new Date(l.createdAt) >= dayStart && +new Date(l.createdAt) < dayEnd).length;
    const dayTours = tours.filter(t => +new Date(t.createdAt || t.scheduledAt) >= dayStart && +new Date(t.createdAt || t.scheduledAt) < dayEnd).length;
    chartData.push({ name: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), Leads: dayLeads, Tours: dayTours });
  }

  const hydratedQueue = queue.map(q => {
    const lead = leads.find(l => l._id.toString() === q.leadId);
    return { ...q, leadName: lead?.name, leadPhone: lead?.phone, leadStage: lead?.stage, leadTcm: lead?.assignedTcmId };
  });

  return {
    kpis: {
      activeLeads: leads.filter(isLeadActive).length,
      hotCount: hotItems.length,
      todayTours: todayTours.length,
      overdueFu,
      incompleteTours: incompleteTours.length,
      conversion,
      booked,
      monthlyRevenue,
    },
    chartData,
    queue: hydratedQueue,
    hotItems: hotItems.map(q => {
      const lead = leads.find(l => l._id.toString() === q.leadId);
      return { ...q, leadName: lead?.name, leadPhone: lead?.phone, leadStage: lead?.stage, leadTcm: lead?.assignedTcmId };
    }),
    todayTours: todayTours.map(t => {
      const lead = leads.find(l => l._id.toString() === t.leadId);
      return { ...t, leadName: lead?.name, leadPhone: lead?.phone, leadStage: lead?.stage };
    }),
    incompleteTours: incompleteTours.map(t => ({
      id: t._id, leadId: t.leadId, scheduledAt: t.scheduledAt, 
      leadName: leads.find(l => l._id.toString() === t.leadId)?.name 
    })),
    // Dummy fields for now until we fully migrate them to backend computation
    metrics: [],
    revivals: [],
  };
}

export async function getArenaTodayData(tenantId: string, role: string, userId: string) {
  const now = Date.now();
  const filterTcmId = role === "tcm" ? userId : undefined;

  const [leads, tours, followUps] = await Promise.all([
    col("leads").find({ tenantId, stage: { $nin: ["booked", "dropped"] } }).toArray(),
    col("tours").find({ tenantId }).toArray(),
    col("follow_ups").find({ tenantId, done: false }).toArray(),
  ]);

  const queue = buildDoNextQueue(leads, tours, followUps, now, filterTcmId);
  const hydratedQueue = queue.map(q => {
    const lead = leads.find(l => l._id.toString() === q.leadId);
    return { 
      ...q, 
      leadName: lead?.name, 
      leadPhone: lead?.phone, 
      leadStage: lead?.stage, 
      leadTcmId: lead?.assignedTcmId,
      confidence: liveConfidence(lead, tours, now)
    };
  });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Scheduled Tours Today
  const scheduledTours = tours.filter(t => t.status === "scheduled" && t.scheduledAt && t.scheduledAt >= todayStart.toISOString() && t.scheduledAt <= todayEnd.toISOString())
    .map(t => {
      const l = leads.find(lead => lead._id.toString() === t.leadId);
      return { ...t, leadName: l?.name };
    });

  return {
    queue: hydratedQueue,
    scheduledTours,
  };
}
