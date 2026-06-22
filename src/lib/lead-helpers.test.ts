import { describe, it, expect } from "vitest";
import {
  isLeadClosed,
  isLeadActive,
  safeParseDate,
  daysUntil,
  daysSince,
  formatArea,
  formatBudget,
  formatAssignee,
  formatMoveInLabel,
  hasCapturedLeadName,
  normalizeLeadName,
  pickRelevantActiveTour,
  resolveBestLeadName,
  isInvalidLocationValue,
  resolveLeadLocation,
} from "./lead-helpers";
import type { Lead, Tour, Property } from "./types";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "test-1",
    name: "Test Lead",
    phone: "+91 9876543210",
    source: "manual",
    budget: 15000,
    moveInDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    preferredArea: "",
    assignedTcmId: "",
    stage: "new",
    intent: "warm",
    confidence: 50,
    tags: [],
    nextFollowUpAt: null,
    responseSpeedMins: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isLeadClosed", () => {
  it("returns true for booked leads", () => {
    expect(isLeadClosed(makeLead({ stage: "booked" }))).toBe(true);
  });
  it("returns true for dropped leads", () => {
    expect(isLeadClosed(makeLead({ stage: "dropped" }))).toBe(true);
  });
  it("returns false for active leads", () => {
    expect(isLeadClosed(makeLead({ stage: "new" }))).toBe(false);
    expect(isLeadClosed(makeLead({ stage: "contacted" }))).toBe(false);
    expect(isLeadClosed(makeLead({ stage: "negotiation" }))).toBe(false);
  });
});

describe("isLeadActive", () => {
  it("returns false for booked leads", () => {
    expect(isLeadActive(makeLead({ stage: "booked" }))).toBe(false);
  });
  it("returns false for dropped leads", () => {
    expect(isLeadActive(makeLead({ stage: "dropped" }))).toBe(false);
  });
  it("returns true for active leads", () => {
    expect(isLeadActive(makeLead({ stage: "new" }))).toBe(true);
  });
});

describe("safeParseDate", () => {
  it("parses valid ISO string", () => {
    const d = safeParseDate("2026-06-01T12:00:00Z");
    expect(d).not.toBeNull();
    expect(d!.getTime()).toBeGreaterThan(0);
  });
  it("returns null for null/undefined", () => {
    expect(safeParseDate(null)).toBeNull();
    expect(safeParseDate(undefined)).toBeNull();
  });
  it("returns null for invalid date string", () => {
    expect(safeParseDate("not-a-date")).toBeNull();
    expect(safeParseDate("")).toBeNull();
  });
});

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString();
    expect(daysUntil(today)).toBe(0);
  });
  it("returns null for invalid date", () => {
    expect(daysUntil("invalid")).toBeNull();
    expect(daysUntil(null)).toBeNull();
  });
  it("returns positive for future date", () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const d = daysUntil(future);
    expect(d).not.toBeNull();
    expect(d).toBeGreaterThanOrEqual(2);
    expect(d).toBeLessThanOrEqual(4);
  });
  it("returns negative for past date", () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const d = daysUntil(past);
    expect(d).not.toBeNull();
    expect(d).toBeLessThan(0);
  });
});

describe("formatArea", () => {
  it("returns preferredArea when available", () => {
    const lead = makeLead({ preferredArea: "HSR Layout" });
    expect(formatArea(lead)).toBe("HSR Layout");
  });
  it("falls back to areas array", () => {
    const lead = makeLead({ preferredArea: "", areas: ["Koramangala"] });
    expect(formatArea(lead)).toBe("Koramangala");
  });
  it("falls back to fullAddress", () => {
    const lead = makeLead({
      preferredArea: "",
      areas: [],
      fullAddress: "123, 1st Main, Indiranagar",
    });
    expect(formatArea(lead)).toBe("123, 1st Main, Indiranagar");
  });
  it("returns Location not captured when all empty", () => {
    const lead = makeLead({ preferredArea: "", areas: [], fullAddress: "" });
    expect(formatArea(lead)).toBe("Location not captured");
  });
  it("handles bare hyphen preferredArea", () => {
    const lead = makeLead({ preferredArea: "-" });
    expect(formatArea(lead)).toBe("Location not captured");
  });
});

describe("formatBudget", () => {
  it("formats valid budget", () => {
    expect(formatBudget(15000)).toBe("₹15k");
  });
  it("returns fallback for zero budget", () => {
    expect(formatBudget(0)).toBe("Budget not specified");
  });
  it("returns fallback for null/undefined", () => {
    expect(formatBudget(null)).toBe("Budget not specified");
    expect(formatBudget(undefined)).toBe("Budget not specified");
  });
  it("returns fallback for NaN budget", () => {
    expect(formatBudget(NaN)).toBe("Budget not specified");
  });
});

describe("formatAssignee", () => {
  it("returns Unassigned when no tcmId", () => {
    expect(formatAssignee(null)).toBe("Unassigned");
    expect(formatAssignee(undefined)).toBe("Unassigned");
    expect(formatAssignee("")).toBe("Unassigned");
  });
  it("returns name when user found", () => {
    expect(formatAssignee("tcm-1", "Aarav Mehta")).toBe("Aarav Mehta");
  });
  it("returns Unassigned when user not found", () => {
    expect(formatAssignee("unknown-id", null)).toBe("Unassigned");
  });
});

describe("formatMoveInLabel", () => {
  it("returns 'Date not set' for null", () => {
    expect(formatMoveInLabel(null)).toBe("Date not set");
    expect(formatMoveInLabel(undefined)).toBe("Date not set");
  });
  it("returns 'Today' for today", () => {
    const today = new Date().toISOString();
    expect(formatMoveInLabel(today)).toBe("Today");
  });
  it("returns 'Tomorrow' for tomorrow", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(formatMoveInLabel(tomorrow)).toBe("Tomorrow");
  });
  it("returns 'Xd overdue' for past dates", () => {
    const past = new Date(Date.now() - 5 * 86_400_000).toISOString();
    expect(formatMoveInLabel(past)).toBe("5d overdue");
  });
  it("returns 'In Xd' for future dates", () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    expect(formatMoveInLabel(future)).toBe("In 3d");
  });
  it("handles invalid dates gracefully", () => {
    expect(formatMoveInLabel("invalid-date")).toBe("Date not set");
  });
});

describe("normalizeLeadName", () => {
  it("passes through valid names", () => {
    expect(normalizeLeadName("Aarav Sharma")).toBe("Aarav Sharma");
    expect(normalizeLeadName("Priya")).toBe("Priya");
    expect(normalizeLeadName("Rohan V. Gupta")).toBe("Rohan V. Gupta");
  });
  it("passes valid short names", () => {
    // Real short names should pass
    expect(normalizeLeadName("Raha")).toBe("Raha");
    expect(normalizeLeadName("Raj")).toBe("Raj");
    expect(normalizeLeadName("Ali")).toBe("Ali");
    expect(normalizeLeadName("Om")).toBe("Om");
  });
  it("passes Indian naming patterns with initials", () => {
    expect(normalizeLeadName("Vinoth Kumar N")).toBe("Vinoth Kumar N");
    expect(normalizeLeadName("R K Sharma")).toBe("R K Sharma");
    expect(normalizeLeadName("Pavan S")).toBe("Pavan S");
  });
  it("returns fallback for null/undefined/empty", () => {
    expect(normalizeLeadName(null)).toBe("Lead name not captured");
    expect(normalizeLeadName(undefined)).toBe("Lead name not captured");
    expect(normalizeLeadName("")).toBe("Lead name not captured");
    expect(normalizeLeadName("  ")).toBe("Lead name not captured");
  });
  it("returns fallback for single-character names", () => {
    // Single chars are ambiguous without context
    expect(normalizeLeadName("x")).toBe("Lead name not captured");
    expect(normalizeLeadName("R")).toBe("Lead name not captured");
    expect(normalizeLeadName("A")).toBe("Lead name not captured");
  });
  it("returns fallback for placeholder values", () => {
    expect(normalizeLeadName("-")).toBe("Lead name not captured");
    expect(normalizeLeadName("—")).toBe("Lead name not captured");
    expect(normalizeLeadName("n/a")).toBe("Lead name not captured");
    expect(normalizeLeadName("test")).toBe("Lead name not captured");
    expect(normalizeLeadName("demo")).toBe("Lead name not captured");
    expect(normalizeLeadName("none")).toBe("Lead name not captured");
    expect(normalizeLeadName("null")).toBe("Lead name not captured");
    expect(normalizeLeadName("Lead name not captured")).toBe("Lead name not captured");
  });
  it("returns fallback for repeated single characters (short)", () => {
    expect(normalizeLeadName("aaa")).toBe("Lead name not captured");
    expect(normalizeLeadName("ffff")).toBe("Lead name not captured");
  });
  it("returns fallback for keyboard-smash fake names", () => {
    expect(normalizeLeadName("fhffh")).toBe("Lead name not captured");
    expect(normalizeLeadName("bfdfd")).toBe("Lead name not captured");
    expect(normalizeLeadName("dgdg")).toBe("Lead name not captured");
    expect(normalizeLeadName("ffhgfhg")).toBe("Lead name not captured");
    expect(normalizeLeadName("dfgbdfgd")).toBe("Lead name not captured");
  });
  it("returns fallback for numbers-only", () => {
    expect(normalizeLeadName("12345")).toBe("Lead name not captured");
  });
});

describe("resolveBestLeadName", () => {
  it("uses valid lead.name as primary source", () => {
    expect(resolveBestLeadName({ name: "Raha Sharma" })).toBe("Raha Sharma");
  });
  it("falls back to notes when name is invalid", () => {
    expect(resolveBestLeadName({ name: "test", notes: "Contact: Raj Kumar" })).toBe("Raj Kumar");
  });
  it("extracts name from first notes line", () => {
    expect(resolveBestLeadName({ name: "-", notes: "Priya Patel\nLooking for 2BHK" })).toBe("Priya Patel");
  });
  it("tries email when name is invalid", () => {
    expect(resolveBestLeadName({ name: "demo", email: "ali.khan@gmail.com" })).toBe("Ali Khan");
  });
  it("prefers name over email when both available", () => {
    expect(resolveBestLeadName({ name: "Vinoth Kumar N", email: "other@test.com" })).toBe("Vinoth Kumar N");
  });
  it("returns original name if all validation fails (graceful fallback)", () => {
    expect(resolveBestLeadName({ name: "x" })).toBe("x");
  });
  it("returns fallback only when truly no sources exist", () => {
    expect(resolveBestLeadName({ name: null, notes: null, email: null, phone: "9876543210" })).toBe("Customer 3210");
  });
});

describe("hasCapturedLeadName", () => {
  it("rejects anonymous placeholder leads", () => {
    expect(hasCapturedLeadName({ name: "Lead name not captured" })).toBe(false);
  });

  it("accepts names recovered from notes or email", () => {
    expect(hasCapturedLeadName({ name: "Lead name not captured", notes: "Name: Kavya Rao" })).toBe(true);
    expect(hasCapturedLeadName({ name: "", email: "rahul.mehta@gmail.com" })).toBe(true);
  });
});

describe("pickRelevantActiveTour", () => {
  function makeActiveTour(id: string, scheduledAt: string): Tour {
    return {
      id,
      leadId: "test-1",
      propertyId: null,
      tcmId: "tcm-1",
      scheduledAt,
      status: "scheduled",
      decision: null,
      postTour: {
        outcome: null,
        confidence: 0,
        objection: null,
        objectionNote: "",
        expectedDecisionAt: null,
        nextFollowUpAt: null,
        filledAt: null,
      },
      createdAt: scheduledAt,
      updatedAt: scheduledAt,
    };
  }

  it("prefers today's tour over future and stale tours", () => {
    const now = new Date("2026-06-03T06:00:00.000Z");
    const today = makeActiveTour("today", "2026-06-03T09:00:00.000Z");
    const tomorrow = makeActiveTour("tomorrow", "2026-06-04T09:00:00.000Z");
    const stale = makeActiveTour("stale", "2026-05-29T09:00:00.000Z");

    expect(pickRelevantActiveTour([tomorrow, stale, today], now.getTime())?.id).toBe("today");
  }, 10000);

  it("uses the nearest future tour when there is no tour today", () => {
    const now = new Date("2026-06-03T06:00:00.000Z");
    const tomorrow = makeActiveTour("tomorrow", "2026-06-04T09:00:00.000Z");
    const nextWeek = makeActiveTour("next-week", "2026-06-10T09:00:00.000Z");
    const stale = makeActiveTour("stale", "2026-05-29T09:00:00.000Z");

    expect(pickRelevantActiveTour([nextWeek, stale, tomorrow], now.getTime())?.id).toBe("tomorrow");
  });

  it("falls back to the latest stale tour only when no future tour exists", () => {
    const now = new Date("2026-06-03T06:00:00.000Z");
    const older = makeActiveTour("older", "2026-05-20T09:00:00.000Z");
    const stale = makeActiveTour("stale", "2026-05-29T09:00:00.000Z");

    expect(pickRelevantActiveTour([older, stale], now.getTime())?.id).toBe("stale");
  });
});

describe("isInvalidLocationValue", () => {
  it("rejects null/undefined/empty", () => {
    expect(isInvalidLocationValue(null)).toBe(true);
    expect(isInvalidLocationValue(undefined)).toBe(true);
    expect(isInvalidLocationValue("")).toBe(true);
  });
  it("rejects placeholder values", () => {
    expect(isInvalidLocationValue("-")).toBe(true);
    expect(isInvalidLocationValue("—")).toBe(true);
    expect(isInvalidLocationValue("ss")).toBe(true);
    expect(isInvalidLocationValue("na")).toBe(true);
    expect(isInvalidLocationValue("n/a")).toBe(true);
    expect(isInvalidLocationValue("none")).toBe(true);
    expect(isInvalidLocationValue("test")).toBe(true);
  });
  it("accepts valid location strings", () => {
    expect(isInvalidLocationValue("HSR Layout")).toBe(false);
    expect(isInvalidLocationValue("Koramangala")).toBe(false);
    expect(isInvalidLocationValue("Bellandur")).toBe(false);
  });
  it("rejects very short strings", () => {
    expect(isInvalidLocationValue("a")).toBe(true);
    expect(isInvalidLocationValue("s")).toBe(true);
  });
});

describe("resolveLeadLocation", () => {
  function makeTour(overrides: Partial<Tour>): Tour {
    return {
      id: "tour-1",
      leadId: "test-1",
      propertyId: null,
      tcmId: "tcm-1",
      scheduledAt: new Date().toISOString(),
      status: "scheduled",
      decision: null,
      postTour: {
        outcome: null,
        confidence: 0,
        objection: null,
        objectionNote: "",
        expectedDecisionAt: null,
        nextFollowUpAt: null,
        filledAt: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it("resolves from preferredArea when no tours", () => {
    const lead = makeLead({ preferredArea: "HSR Layout" });
    const result = resolveLeadLocation(lead, [], []);
    expect(result.area).toBe("HSR Layout");
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });

  it("falls back to Property Hub when everything empty", () => {
    const lead = makeLead({ preferredArea: "", areas: [], fullAddress: "" });
    const result = resolveLeadLocation(lead, [], []);
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });

  it("works without tours and properties arrays passed", () => {
    const lead = makeLead({ preferredArea: "HSR Layout" });
    const result = resolveLeadLocation(lead);
    expect(result.area).toBe("HSR Layout");
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });

  it("rejects invalid preferredArea values", () => {
    const lead = makeLead({ preferredArea: "ss" });
    const result = resolveLeadLocation(lead, [], []);
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });

  it("falls back from invalid area to areas array", () => {
    const lead = makeLead({ preferredArea: "-", areas: ["Koramangala"] });
    const result = resolveLeadLocation(lead, [], []);
    expect(result.area).toBe("Koramangala");
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });

  it("falls back to fullAddress when preferredArea invalid and areas empty", () => {
    const lead = makeLead({
      preferredArea: "-",
      areas: [],
      fullAddress: "123, Indiranagar",
    });
    const result = resolveLeadLocation(lead, [], []);
    expect(result.area).toBe("Indiranagar");
    expect(result.propertyName).not.toBeNull();
    expect(result.source).toBe("hub");
  });
});
