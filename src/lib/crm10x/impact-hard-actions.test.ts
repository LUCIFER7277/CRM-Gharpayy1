import { describe, expect, it } from "vitest";
import { mapNbaToFocusAction, topSuggestion } from "./impact-hard-actions";
import type { ImpactEnrichedPick } from "./impact-hard-actions";
import type { Lead } from "@/lib/types";

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "name">): Lead {
  return {
    phone: partial.phone ?? "9999999999",
    source: "manual",
    budget: 12000,
    moveInDate: "2026-06-01",
    preferredArea: "Koramangala",
    assignedTcmId: "tcm-1",
    stage: partial.stage ?? "new",
    intent: partial.intent ?? "warm",
    confidence: 50,
    tags: [],
    nextFollowUpAt: null,
    responseSpeedMins: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  } as Lead;
}

function pick(partial: Partial<ImpactEnrichedPick> & { lead: Lead }): ImpactEnrichedPick {
  return {
    nba: { verb: "call", label: "Call", reason: "test", pressure: "normal", ageMinutes: 0 },
    score: 50,
    column: "inbox",
    ...partial,
  };
}

describe("topSuggestion", () => {
  it("returns a lead without throwing (regression: undefined e)", () => {
    const list = [
      pick({
        lead: lead({ id: "1", name: "A" }),
        nba: {
          verb: "schedule",
          label: "Schedule",
          reason: "new",
          pressure: "normal",
          ageMinutes: 0,
        },
      }),
    ];
    expect(topSuggestion(list)?.lead.id).toBe("1");
  });

  it("prefers escalate pressure", () => {
    const list = [
      pick({
        lead: lead({ id: "1", name: "A" }),
        nba: { verb: "call", label: "Call", reason: "", pressure: "normal", ageMinutes: 0 },
      }),
      pick({
        lead: lead({ id: "2", name: "B" }),
        nba: { verb: "quote", label: "Quote", reason: "", pressure: "escalate", ageMinutes: 100 },
      }),
    ];
    expect(topSuggestion(list)?.lead.id).toBe("2");
  });
});

describe("mapNbaToFocusAction", () => {
  it("maps verbs and columns", () => {
    expect(mapNbaToFocusAction("quote", "inbox", false)).toBe("quote");
    expect(mapNbaToFocusAction("rest", "booked", false)).toBe("checkin");
  });
});
