import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { Lead } from "../../../../src/contracts/entities.js";
import {
  CreateLeadCmd,
  UpdateLeadCmd,
  AssignLeadCmd,
  ChangeStageCmd,
  DeleteLeadCmd,
  type Command,
} from "../../../../src/contracts/commands.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import { toE164 } from "../../platform/phone.js";
import { withRetry, isMongoConflict } from "../../platform/retry.js";
import { maybeReserveCommand } from "../../platform/dedup.js";
import { cmdCounter, cmdLatency } from "../../platform/metrics.js";
import {
  createLeadAssignmentNotification,
  applyAssignmentCommand,
} from "./assignment-notification-handlers.js";

const LEADS = "leads";
const LEDGER = "command_ledger";
const PHONE_INDEX = "lead_phone_index";
const LEAD_NAME_NOT_CAPTURED = "Lead name not captured";

interface LedgerDoc {
  _id: string;
  type: string;
  actor: string;
  tenantId: string;
  appliedAt: string;
  appliedAtTtl: Date;       // for TTL index
  result: { ok: true; eventIds: string[]; data?: Record<string, unknown> } | { ok: false; error: string };
}

interface PhoneIndexDoc {
  _id: string;              // `${tenantId}:${phoneE164}`
  tenantId: string;
  phoneE164: string;
  leadId: string;
  createdAt: string;
}

function looksLikeKeyboardSmash(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-z]/g, "");
  if (compact.length < 4 || /\s/.test(value)) return false;
  const vowels = compact.match(/[aeiou]/g)?.length ?? 0;
  if (vowels === 0) return true;
  return compact.length >= 6 && vowels / compact.length <= 0.15;
}

function normalizeLeadName(value: string | null | undefined): string {
  if (!value) return LEAD_NAME_NOT_CAPTURED;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length === 1) return LEAD_NAME_NOT_CAPTURED;
  const lower = trimmed.toLowerCase();
  if (
    /^-+$/.test(lower) ||
    /^—+$/.test(lower) ||
    /^_+$/.test(lower) ||
    /^\.+$/.test(lower) ||
    /^(n\/?a|na|none|null|undefined)$/i.test(lower) ||
    /^(test|demo|sample|temp|testing|dummy)$/i.test(lower) ||
    /^(uploaded lead|lead \d+|customer \d+)$/i.test(lower) ||
    (/^(.)\1{2,}$/.test(trimmed) && trimmed.length <= 4) ||
    /^\d+$/.test(trimmed) ||
    looksLikeKeyboardSmash(trimmed)
  ) {
    return LEAD_NAME_NOT_CAPTURED;
  }
  return trimmed;
}

/** Idempotent: same command._id → same result. Two-tier dedup + conflict-aware retry. */
export async function dispatch(rawCmd: Command, user: JwtClaims) {
  const start = Date.now();
  const ledger = col<LedgerDoc>(LEDGER);

  // Tier 1: Redis fast path (cheap pre-DB reject; absorbs retry storms).
  // Tier 2: Mongo ledger (durable truth; survives Redis loss).
  await maybeReserveCommand(rawCmd._id);
  const existing = await ledger.findOne({ _id: rawCmd._id });
  if (existing) {
    cmdCounter.inc({ type: rawCmd.type, outcome: "replay" });
    cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: "replay" });
    return existing.result;
  }

  let result: LedgerDoc["result"];
  try {
    // Conflict-aware retry inside the bus. Handlers that hit a duplicate seq /
    // WriteConflict get up to 3 reloads with jitter — kills tail latency under
    // hot-aggregate contention without bubbling 5xx to clients.
    result = await withRetry(() => applyCommand(rawCmd, user), {
      tries: 3, baseMs: 10, jitterMs: 30, isRetriable: isMongoConflict,
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    result = { ok: false, error: `${err.code ?? "INTERNAL"}: ${err.message}` };
  }

  try {
    await ledger.insertOne({
      _id: rawCmd._id, type: rawCmd.type, actor: user.sub, tenantId: user.tenantId,
      appliedAt: new Date().toISOString(), appliedAtTtl: new Date(), result,
    });
  } catch (e) {
    // Concurrent retry won the race → return its result instead of erroring.
    if (isMongoConflict(e)) {
      const won = await ledger.findOne({ _id: rawCmd._id });
      if (won) {
        cmdCounter.inc({ type: rawCmd.type, outcome: "replay-race" });
        cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: "replay-race" });
        return won.result;
      }
    }
    throw e;
  }

  cmdCounter.inc({ type: rawCmd.type, outcome: result.ok ? "ok" : "error" });
  cmdLatency.observe(Date.now() - start, { type: rawCmd.type, outcome: result.ok ? "ok" : "error" });
  return result;
}

async function applyCommand(cmd: Command, user: JwtClaims): Promise<LedgerDoc["result"]> {
  // Delegate todo commands
  if (cmd.type.startsWith("cmd.todo.")) {
    const { applyTodoCommand } = await import("../todos/command-handlers.js");
    return (applyTodoCommand as any)(cmd, user);
  }
  // Delegate tour commands
  if (cmd.type.startsWith("cmd.tour.")) {
    const { applyTourCommand } = await import("../tours/command-handlers.js");
    return (applyTourCommand as any)(cmd, user);
  }
  // Delegate activity commands
  if (cmd.type.startsWith("cmd.activity.")) {
    const { applyActivityCommand } = await import("../activities/command-handlers.js");
    return (applyActivityCommand as any)(cmd, user);
  }
  // Delegate assignment notification commands
  if (cmd.type === "cmd.lead.accept_assignment" || cmd.type === "cmd.lead.pass_assignment") {
    return applyAssignmentCommand(cmd, user);
  }
  // Delegate booking commands
  if (cmd.type.startsWith("cmd.booking.")) {
    const { applyBookingCommand } = await import("../bookings/command-handlers.js");
    return (applyBookingCommand as any)(cmd, user);
  }
  // Delegate tenant commands
  if (cmd.type.startsWith("cmd.tenant.")) {
    const { applyTenantCommand } = await import("../tenants/command-handlers.js");
    return (applyTenantCommand as any)(cmd, user);
  }

  const { autoLogActivity } = await import("../activities/command-handlers.js");

  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.lead.create": {
      const p = CreateLeadCmd.parse(cmd).payload;

      // Phone normalization to E.164. Rejects on unparseable input rather than
      // letting bad data flood the system.
      const phoneE164 = toE164(p.phone);
      if (!phoneE164) {
        return { ok: false, error: "VALIDATION_FAILED: Invalid phone number" };
      }

      // Atomic dedup claim. Insert into the unique index FIRST; on E11000 →
      // surface the existing leadId. This is the only thing that holds when
      // the same lead arrives from 5 sources within milliseconds.
      const leadId = ulid();
      const phoneKey = `${user.tenantId}:${phoneE164}`;
      const phoneIndex = col<PhoneIndexDoc>(PHONE_INDEX);

      // Atomic claim acquisition without insert races: if key doesn't exist we
      // create it for this leadId, otherwise we get the existing claim back.
      const existingClaim = await phoneIndex.findOneAndUpdate(
        { _id: phoneKey },
        {
          $setOnInsert: {
            _id: phoneKey,
            tenantId: user.tenantId,
            phoneE164,
            leadId,
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "before" },
      );

      if (existingClaim) {
        const existingLeadId = existingClaim.leadId;
        if (existingLeadId) {
          const existingLead = await col(LEADS).findOne({ _id: existingLeadId, tenantId: user.tenantId });
          if (existingLead) {
            let lead = Lead.parse(existingLead);
            if (p.assigneeId && (lead.assignedTcmId !== p.assigneeId || lead.assigneeId !== p.assigneeId)) {
              await col(LEADS).updateOne(
                { _id: existingLeadId, tenantId: user.tenantId },
                { $set: { assignedTcmId: p.assigneeId, assigneeId: p.assigneeId, updatedAt: now }, $inc: { __v: 1 } },
              );
              lead = { ...lead, assignedTcmId: p.assigneeId, assigneeId: p.assigneeId, updatedAt: now };
            }
            const evtId = newEventId();
            await emit({
              _id: evtId, type: "evt.lead.created", occurredAt: now,
              actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
              payload: { lead },
            });
            return { ok: true, eventIds: [evtId], data: { duplicate: true, leadId: existingLeadId } };
          }

          // Orphaned claim: steal it only if no one changed it after we read it.
          const reclaimed = await phoneIndex.updateOne(
            { _id: phoneKey, leadId: existingLeadId },
            { $set: { leadId, tenantId: user.tenantId, phoneE164, createdAt: now } },
          );
          if (reclaimed.matchedCount === 0) {
            throw Object.assign(new Error("Stale phone-index claim could not be reclaimed"), { code: "CONFLICT" });
          }
        } else {
          // Legacy/malformed claim with missing leadId.
          const reclaimed = await phoneIndex.updateOne(
            {
              _id: phoneKey,
              $or: [{ leadId: { $exists: false } }, { leadId: null }, { leadId: "" }],
            } as any,
            { $set: { leadId, tenantId: user.tenantId, phoneE164, createdAt: now } },
          );
          if (reclaimed.matchedCount === 0) {
            throw Object.assign(new Error("Malformed phone-index claim could not be reclaimed"), { code: "CONFLICT" });
          }
        }
      }

      const lead = Lead.parse({
        _id: leadId,
        ...p,
        name: normalizeLeadName(p.name),
        phone: phoneE164,                  // store the canonical form
        intent: p.intent ?? (p.quality === "hot" ? "hot" : p.quality === "bad" ? "cold" : "warm"),
        tags: p.tags ?? [],
        zoneId: p.zoneId ?? null,
        assignedTcmId: null,              // NOT assigned until notification is accepted
        stage: "new",
        confidence: p.quality === "hot" ? 90 : p.quality === "good" ? 70 : p.quality === "bad" ? 30 : 50,
        nextFollowUpAt: null,
        responseSpeedMins: 0,
        budgetText: p.budgetText ?? "",
        email: p.email ?? "",
        areas: p.areas ?? [],
        fullAddress: p.fullAddress ?? "",
        type: p.type ?? "",
        room: p.room ?? "",
        need: p.need ?? "",
        inBLR: p.inBLR ?? null,
        quality: p.quality ?? null,
        specialReqs: p.specialReqs ?? "",
        notes: p.notes ?? "",
        zoneCategory: p.zoneCategory ?? "",
        assigneeId: null,                 // NOT assigned until notification is accepted
        stageLabel: p.stageLabel ?? "",
        createdAt: now,
        updatedAt: now,
        createdBy: user.sub,
        tenantId: user.tenantId,
      });
      // Add __v=1 — optimistic concurrency anchor. All future updates check it.
      await col(LEADS).insertOne({ ...lead, __v: 1 } as unknown as Record<string, unknown>);
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.created", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { lead },
      });
      await autoLogActivity({
        entityType: "lead", entityId: lead._id, kind: "created",
        subject: `Lead created · ${lead.name}`,
        body: `Source: ${lead.source} · Budget: ₹${lead.budget?.toLocaleString()} · Area: ${lead.preferredArea}`,
        meta: { source: lead.source, intent: lead.intent },
        user, correlationId,
      });

      if (p.parsedByAI) {
        await autoLogActivity({
          entityType: "lead", entityId: lead._id, kind: "ai_parse",
          subject: `AI Extraction (${p.aiConfidence || 0}% confidence)`,
          body: `Source: WhatsApp Paste\nMissing Fields: ${(p.missingFields || []).join(", ") || "None"}\n\nRaw:\n${p.rawSource || ""}`,
          meta: { aiConfidence: p.aiConfidence, rawSource: p.rawSource, missing: p.missingFields || [], source: "WhatsApp Paste" },
          user, correlationId,
        });
      }

      // If an assignee was specified AND it's not the creator themselves,
      // create a pending assignment notification. If assigning to self, directly
      // set the assigneeId (no need to notify yourself).
      if (p.assigneeId) {
        if (p.assigneeId === user.sub) {
          // Self-assignment: directly assign without notification
          await col(LEADS).updateOne(
            { _id: lead._id, tenantId: user.tenantId },
            { $set: { assignedTcmId: user.sub, assigneeId: user.sub, updatedAt: now }, $inc: { __v: 1 } as any },
          );
        } else {
          const assigner = await col<UserDoc>("users").findOne({ _id: user.sub, tenantId: user.tenantId });
          await createLeadAssignmentNotification({
            leadId: lead._id,
            leadName: lead.name,
            assignedById: user.sub,
            assignedByName: assigner?.fullName ?? user.fullName ?? user.sub,
            assignedToId: p.assigneeId,
            tenantId: user.tenantId,
          });
        }
      }

      return { ok: true, eventIds: [evtId], data: { leadId } };
    }

    case "cmd.lead.update": {
      const p = UpdateLeadCmd.parse(cmd).payload;
      const patch = {
        ...p.patch,
        ...(p.patch.name != null ? { name: normalizeLeadName(p.patch.name) } : {}),
        updatedAt: now,
      };
      // Optimistic concurrency: $inc __v atomically. If client supplied
      // expectedVersion (future-proof), enforce it; otherwise just bump.
      const expected = (cmd as unknown as { expectedVersion?: number }).expectedVersion;
      const filter: Record<string, unknown> = { _id: p.leadId, tenantId: user.tenantId };
      if (typeof expected === "number") filter.__v = expected;
      const r = await col(LEADS).updateOne(filter, { $set: patch, $inc: { __v: 1 } });
      if (r.matchedCount === 0) {
        const stillExists = await col(LEADS).findOne({ _id: p.leadId, tenantId: user.tenantId });
        if (!stillExists) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
        throw Object.assign(new Error("Version conflict — reload and retry"), { code: "CONFLICT" });
      }
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.updated", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, patch },
      });
      const changedKeys = Object.keys(p.patch).filter((k) => k !== "updatedAt");
      if (changedKeys.length > 0) {
        await autoLogActivity({
          entityType: "lead", entityId: p.leadId, kind: "field_changed",
          subject: `Updated: ${changedKeys.join(", ")}`,
          body: changedKeys.map((k) => `${k}: ${JSON.stringify((p.patch as Record<string, unknown>)[k])}`).join(" · "),
          meta: { changedKeys, patch: p.patch },
          user, correlationId,
        });
      }
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.assign": {
      const p = AssignLeadCmd.parse(cmd).payload;

      // Fetch the lead to get its name for the notification
      const lead = await col<Lead>(LEADS).findOne({ _id: p.leadId, tenantId: user.tenantId });
      if (!lead) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });

      // Self-assignment: directly assign without creating a notification
      if (p.tcmId === user.sub) {
        const r = await col(LEADS).updateOne(
          { _id: p.leadId, tenantId: user.tenantId },
          { $set: { assignedTcmId: user.sub, assigneeId: user.sub, updatedAt: now }, $inc: { __v: 1 } as any },
        );
        if (r.matchedCount === 0) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
        const selfEvtId = newEventId();
        await emit({
          _id: selfEvtId, type: "evt.lead.assigned", occurredAt: now,
          actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
          payload: { leadId: p.leadId, tcmId: p.tcmId },
        });
        return { ok: true, eventIds: [selfEvtId] };
      }

      // Create a pending assignment notification instead of directly assigning
      const assigner = await col<UserDoc>("users").findOne({ _id: user.sub, tenantId: user.tenantId });
      await createLeadAssignmentNotification({
        leadId: p.leadId,
        leadName: lead.name,
        assignedById: user.sub,
        assignedByName: assigner?.fullName ?? user.fullName ?? user.sub,
        assignedToId: p.tcmId,
        tenantId: user.tenantId,
      });

      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.assignment_pending", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, tcmId: p.tcmId },
      });
      await autoLogActivity({
        entityType: "lead", entityId: p.leadId, kind: "assigned",
        subject: `Assignment pending`,
        body: `Pending acceptance by ${p.tcmId}`,
        meta: { tcmId: p.tcmId },
        user, correlationId,
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.change_stage": {
      const p = ChangeStageCmd.parse(cmd).payload;
      // Atomic read-modify-write via findOneAndUpdate so two concurrent stage
      // changes can't lose the "from" value.
      const before = await col<{ stage: string; __v?: number }>(LEADS).findOneAndUpdate(
        { _id: p.leadId, tenantId: user.tenantId },
        { $set: { stage: p.to, updatedAt: now }, $inc: { __v: 1 } },
        { returnDocument: "before" },
      );
      if (!before) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.stage_changed", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId, from: before.stage, to: p.to },
      });
      await autoLogActivity({
        entityType: "lead", entityId: p.leadId, kind: "stage_changed",
        subject: `Stage: ${before.stage} → ${p.to}`,
        meta: { from: before.stage, to: p.to },
        user, correlationId,
      });
      return { ok: true, eventIds: [evtId] };
    }


    case "cmd.lead.delete": {
      const p = DeleteLeadCmd.parse(cmd).payload;
      const before = await col<{ phone: string }>(LEADS).findOne({ _id: p.leadId, tenantId: user.tenantId });
      const r = await col(LEADS).deleteOne({ _id: p.leadId, tenantId: user.tenantId });
      if (r.deletedCount === 0) throw Object.assign(new Error("Lead not found"), { code: "NOT_FOUND" });
      // Release the phone-index claim so the same number can be re-onboarded.
      if (before?.phone) {
        const normalizedPhone = toE164(before.phone) ?? before.phone;
        await col<PhoneIndexDoc>(PHONE_INDEX).deleteOne({ _id: `${user.tenantId}:${normalizedPhone}` });
      }
      // Best-effort cleanup if phone format changed over time.
      await col<PhoneIndexDoc>(PHONE_INDEX).deleteOne({ tenantId: user.tenantId, leadId: p.leadId });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.deleted", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: p.leadId },
      });
      return { ok: true, eventIds: [evtId] };
    }
  }
  throw Object.assign(new Error(`Unknown command type: ${(cmd as { type: string }).type}`), { code: "BAD_COMMAND" });
}
