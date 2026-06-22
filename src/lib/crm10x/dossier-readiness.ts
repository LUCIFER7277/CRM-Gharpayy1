import { useCRM10x } from "./store";
import type { Lead } from "@/lib/types";
import type { DeepLeadProfile } from "./types";

/** Fields we treat as the minimum Dossier needed before scheduling a tour. */
export const DOSSIER_REQUIRED_FIELDS: Array<{
  key: keyof DeepLeadProfile;
  label: string;
}> = [
  { key: "gender", label: "PG type" },
  { key: "roomType", label: "Room type" },
  { key: "furnishing", label: "Furnishing" },
  { key: "food", label: "Food pref" },
  { key: "source", label: "Source" },
  { key: "decisionMaker", label: "Decision maker" },
  { key: "language", label: "Language" },
  { key: "companyOrCollege", label: "Company / college" },
  { key: "budgetStated", label: "Stated budget" },
  { key: "verifiedBudget", label: "Budget verification" },
];

export interface DossierReadiness {
  ready: boolean;
  missing: string[];
  filledCount: number;
  totalCount: number;
}

export function computeDossierReadiness(
  profile: DeepLeadProfile | undefined,
): DossierReadiness {
  const missing: string[] = [];
  let filled = 0;
  for (const f of DOSSIER_REQUIRED_FIELDS) {
    const v = profile?.[f.key];
    if (v === undefined || v === null || v === "" || (typeof v === "number" && v <= 0)) {
      missing.push(f.label);
    } else {
      filled += 1;
    }
  }
  return {
    ready: missing.length === 0,
    missing,
    filledCount: filled,
    totalCount: DOSSIER_REQUIRED_FIELDS.length,
  };
}

/** Hook — subscribes to the profile in the CRM10x store. */
export function useDossierReadiness(lead: Lead | null | undefined): DossierReadiness {
  const profile = useCRM10x((s) => (lead ? s.profiles[lead.id] : undefined));
  return computeDossierReadiness(profile);
}
