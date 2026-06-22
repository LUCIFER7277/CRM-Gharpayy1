import type { Lead as AppLead } from "@/lib/types";
import { matchLead, type Lead as SupplyLead } from "@/supply-hub/lib/matcher";

export interface InlineLeadMatch {
  propertyId: string;
  propertyName: string;
  area: string;
  score: number;
  label: string;
  commuteKm: number | null;
  reasoning: string;
}

function deriveGender(lead: AppLead): SupplyLead["gender"] {
  const tags = lead.tags.map((t) => t.toLowerCase());
  if (tags.includes("girls")) return "Girls";
  if (tags.includes("boys")) return "Boys";
  return "Any";
}

function deriveAudience(lead: AppLead): SupplyLead["audience"] {
  const tags = lead.tags.map((t) => t.toLowerCase());
  if (tags.includes("student")) return "Student";
  if (tags.includes("working")) return "Working";
  return "Both";
}

export function toSupplyLead(lead: AppLead): SupplyLead {
  return {
    name: lead.name,
    phone: lead.phone,
    area: lead.preferredArea,
    gender: deriveGender(lead),
    budgetMin: Math.max(7000, Math.round(lead.budget * 0.85)),
    budgetMax: Math.max(lead.budget, Math.round(lead.budget * 1.15)),
    audience: deriveAudience(lead),
    occupancy: "Any",
    notes: lead.tags.join(", "),
  };
}

export function bestMatchesForLead(lead: AppLead, limit = 5): InlineLeadMatch[] {
  return matchLead(toSupplyLead(lead))
    .filter((m) => !m.disqualified && m.total > 0)
    .slice(0, limit)
    .map((m) => ({
      propertyId: m.pg.id,
      propertyName: m.pg.name,
      area: m.pg.area,
      score: m.total,
      label: m.bedLabel,
      commuteKm: m.commuteKm,
      reasoning: m.reasoning,
    }));
}
