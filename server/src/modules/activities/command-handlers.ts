import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { Activity } from "../../../../src/contracts/entities.js";
import {
  LogActivityCmd, UpdateActivityCmd, DeleteActivityCmd, type Command,
} from "../../../../src/contracts/commands.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";

const ACTIVITIES = "activities";

type Result = { ok: true; eventIds: string[] } | { ok: false; error: string };

export async function applyActivityCommand(cmd: Command, user: JwtClaims): Promise<Result> {
  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.activity.log": {
      const p = LogActivityCmd.parse(cmd).payload;
      const activity = Activity.parse({
        _id: ulid(),
        entityType: p.entityType,
        entityId: p.entityId,
        kind: p.kind,
        subject: p.subject,
        body: p.body ?? "",
        direction: p.direction ?? "internal",
        outcome: p.outcome ?? null,
        durationSec: p.durationSec ?? 0,
        occurredAt: p.occurredAt ?? now,
        scheduledFor: p.scheduledFor ?? null,
        relatedTodoId: p.relatedTodoId ?? null,
        meta: p.meta ?? {},
        actor: user.sub,
        tenantId: user.tenantId,
        createdAt: now,
      });
      await col(ACTIVITIES).insertOne(activity as unknown as Record<string, unknown>);
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.activity.logged", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { activity },
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.activity.update": {
      const p = UpdateActivityCmd.parse(cmd).payload;
      const r = await col(ACTIVITIES).updateOne(
        { _id: p.activityId, tenantId: user.tenantId },
        { $set: p.patch },
      );
      if (r.matchedCount === 0) throw Object.assign(new Error("Activity not found"), { code: "NOT_FOUND" });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.activity.updated", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { activityId: p.activityId, patch: p.patch as Partial<Activity> },
      });
      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.activity.delete": {
      const p = DeleteActivityCmd.parse(cmd).payload;
      const before = await col<Activity>(ACTIVITIES).findOne({ _id: p.activityId, tenantId: user.tenantId });
      if (!before) throw Object.assign(new Error("Activity not found"), { code: "NOT_FOUND" });
      await col(ACTIVITIES).deleteOne({ _id: p.activityId, tenantId: user.tenantId });
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.activity.deleted", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { activityId: p.activityId, entityType: before.entityType, entityId: before.entityId },
      });
      return { ok: true, eventIds: [evtId] };
    }

    default:
      throw new Error(`Unhandled activity command: ${(cmd as { type: string }).type}`);
  }
}

/** System auto-log helper — used by other modules (e.g. lead handlers) to write
 *  timeline entries without going through the public command bus. */
export async function autoLogActivity(input: {
  entityType: Activity["entityType"];
  entityId: string;
  kind: Activity["kind"];
  subject: string;
  body?: string;
  meta?: Record<string, unknown>;
  user: JwtClaims;
  correlationId: string;
}) {
  const now = new Date().toISOString();
  const activity = Activity.parse({
    _id: ulid(),
    entityType: input.entityType,
    entityId: input.entityId,
    kind: input.kind,
    subject: input.subject,
    body: input.body ?? "",
    direction: "internal",
    outcome: null,
    durationSec: 0,
    occurredAt: now,
    scheduledFor: null,
    relatedTodoId: null,
    meta: input.meta ?? {},
    actor: input.user.sub,
    tenantId: input.user.tenantId,
    createdAt: now,
  });
  await col(ACTIVITIES).insertOne(activity as unknown as Record<string, unknown>);
  await emit({
    _id: newEventId(), type: "evt.activity.logged", occurredAt: now,
    actor: input.user.sub, tenantId: input.user.tenantId,
    correlationId: input.correlationId, causationId: null, version: 1,
    payload: { activity },
  });
}
