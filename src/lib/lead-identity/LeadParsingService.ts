import { parseLead } from "./parser";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

export interface AIParsedLead {
  confidence: number;
  fields: {
    name: string | null;
    phone: string | null;
    email: string | null;
    budget: string | null;
    moveIn: string | null;
    area: string | null;
    need: string | null;
    type: string | null;
    room: string | null;
    specialReqs: string | null;
    internalNotes: string | null;
  };
  missing: string[];
  parsedByAI: boolean;
  rawSource: string;
}

export class LeadParsingService {
  /**
   * Parses unstructured text into lead fields.
   * Attempts to use the Gemini AI backend route first.
   * If it fails (network error, 500, etc), falls back to the local regex parser.
   */
  static async parseLead(rawText: string, dynamicZones?: import("@/lib/api/client").Zone[]): Promise<AIParsedLead> {
    const rawTrimmed = rawText.trim();
    if (!rawTrimmed || rawTrimmed.length < 4) {
      return this.emptyResult(rawTrimmed);
    }

    try {
      console.log("Attempting AI Parse via api.leads.parseLead...");
      // 1. Try AI Parser via backend
      const data = await api.leads.parseLead(rawTrimmed);

      if (data && typeof data === "object") {
        console.log("AI Parse Success. Received data:", data);
        return {
          confidence: data.confidence ?? 80,
          fields: {
            name: data.fields?.name ?? null,
            phone: data.fields?.phone ?? null,
            email: data.fields?.email ?? null,
            budget: data.fields?.budget ?? null,
            moveIn: data.fields?.moveIn ?? null,
            area: data.fields?.area ?? null,
            need: data.fields?.need ?? null,
            type: data.fields?.type ?? null,
            room: data.fields?.room ?? null,
            specialReqs: data.fields?.specialReqs ?? null,
            internalNotes: data.fields?.internalNotes ?? null,
          },
          missing: data.missing ?? [],
          parsedByAI: true,
          rawSource: rawTrimmed,
        };
      }
    } catch (err) {
      console.error("AI Parse Failed. Network/Server error:", err);
      console.warn("Falling back to regex.");
      toast.error("AI Parser unavailable. Falling back to simple regex matching.");
    }

    console.log("Fallback Regex Used for parsing:", rawTrimmed);
    // 2. Fallback to Regex Parser
    const parsed = parseLead(rawTrimmed, dynamicZones);
    if (!parsed) {
      return this.emptyResult(rawTrimmed);
    }

    const fields = {
      name: parsed.name || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      budget: parsed.budget || null,
      moveIn: parsed.moveIn || null,
      area: parsed.location || (parsed.areas && parsed.areas.length > 0 ? parsed.areas.join(", ") : null),
      need: parsed.need || null,
      type: parsed.type || null,
      room: parsed.room || null,
      specialReqs: parsed.specialReqs || null,
      internalNotes: parsed.extraContent || null,
    };

    const missing: string[] = [];
    (Object.keys(fields) as Array<keyof typeof fields>).forEach((key) => {
      if (!fields[key]) missing.push(key);
    });

    // Approximate confidence based on field presence
    let fallbackConfidence = 50;
    if (fields.phone) fallbackConfidence += 20;
    if (fields.name) fallbackConfidence += 10;
    if (fields.budget) fallbackConfidence += 10;
    if (fields.area) fallbackConfidence += 10;

    return {
      confidence: Math.min(fallbackConfidence, 95), // Max 95 for fallback
      fields,
      missing,
      parsedByAI: false,
      rawSource: rawTrimmed,
    };
  }

  private static emptyResult(rawSource: string): AIParsedLead {
    return {
      confidence: 0,
      fields: {
        name: null, phone: null, email: null, budget: null, moveIn: null,
        area: null, need: null, type: null, room: null, specialReqs: null, internalNotes: null
      },
      missing: ["name", "phone", "email", "budget", "moveIn", "area", "need", "type", "room", "specialReqs", "internalNotes"],
      parsedByAI: false,
      rawSource,
    };
  }
}
