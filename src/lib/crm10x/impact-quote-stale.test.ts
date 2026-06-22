import { describe, expect, it } from "vitest";
import { isQuoteStale } from "./impact-quote-stale";
import type { Quotation } from "@/lib/crm10x/quotations";

describe("isQuoteStale", () => {
  it("is false for paid quotes", () => {
    expect(
      isQuoteStale({
        id: "q1",
        leadId: "l1",
        status: "paid",
        sentAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
      } as Quotation),
    ).toBe(false);
  });

  it("is true when sent 25h ago", () => {
    expect(
      isQuoteStale({
        id: "q1",
        leadId: "l1",
        status: "sent",
        sentAt: new Date(Date.now() - 25 * 3600_000).toISOString(),
      } as Quotation),
    ).toBe(true);
  });
});
