import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import {
  ScheduleTourCmd,
  RescheduleTourCmd,
  CancelTourCmd,
  CompleteTourCmd,
  UpdateTourCmd,
  UpdatePostTourCmd,
  type Command,
} from "../../../../src/contracts/commands.js";
import { Tour, Lead, PostTourUpdate } from "../../../../src/contracts/entities.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import { autoLogActivity } from "../activities/command-handlers.js";
import {
  createTourAssignmentNotification,
  applyAssignmentCommand,
} from "../leads/assignment-notification-handlers.js";

const TOURS = "tours";

export async function applyTourCommand(cmd: Command, user: JwtClaims) {
  // Delegate assignment notification commands
  if (cmd.type === "cmd.tour.accept_assignment" || cmd.type === "cmd.tour.pass_assignment") {
    return applyAssignmentCommand(cmd, user);
  }

  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.tour.schedule": {
      const p = ScheduleTourCmd.parse(cmd).payload;
      const lead = await col<Lead>("leads").findOne({ _id: p.leadId, tenantId: user.tenantId });
      if (!lead) {
        return { ok: false, error: "NOT_FOUND: Lead not found" };
      }

      const tour: Tour = {
        _id: ulid(),
        leadId: p.leadId,
        propertyId: p.propertyId ?? null,
        assignedTo: p.tcmId,
        scheduledBy: user.sub,
        scheduledAt: p.scheduledAt,
        status: "scheduled",
        showUp: null,
        customPropertyName: "",
        bookingSource: p.bookingSource ?? "whatsapp",
        tourType: p.tourType ?? "physical",
        postTour: {
          outcome: null,
          confidence: 0,
          objection: null,
          objectionNote: "",
          expectedDecisionAt: null,
          nextFollowUpAt: null,
          filledAt: null,
        },
        createdAt: now,
        updatedAt: now,
        tenantId: user.tenantId,
      };

      await col<Tour>(TOURS).insertOne(tour);
      await col<Lead>("leads").updateOne(
        { _id: p.leadId, tenantId: user.tenantId },
        { $set: { stage: "tour-scheduled", updatedAt: now } },
      );

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tour.scheduled",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tour },
      });

      await autoLogActivity({
        entityType: "lead",
        entityId: p.leadId,
        kind: "tour_scheduled",
        subject: `Tour scheduled`,
        body: `Tour scheduled for lead ${lead.name}`,
        meta: { tourId: tour._id, assignedTo: tour.assignedTo },
        user,
        correlationId,
      });

      // Create a pending assignment notification for the TCM, UNLESS the
      // scheduler is scheduling for themselves (self-assignment: no notification needed).
      if (p.tcmId !== user.sub) {
        const schedUser = await col<UserDoc>("users").findOne({ _id: user.sub, tenantId: user.tenantId });
        await createTourAssignmentNotification({
          tourId: tour._id,
          leadId: p.leadId,
          leadName: lead.name,
          assignedById: user.sub,
          assignedByName: schedUser?.fullName ?? user.fullName ?? user.sub,
          assignedToId: p.tcmId,
          tenantId: user.tenantId,
        });
      }

      return { ok: true, eventIds: [evtId], data: { tour } };
    }

    case "cmd.tour.reschedule": {
      const p = RescheduleTourCmd.parse(cmd).payload;
      const tour = await col<Tour>(TOURS).findOneAndUpdate(
        { _id: p.tourId, tenantId: user.tenantId },
        { $set: { scheduledAt: p.scheduledAt, updatedAt: now } },
        { returnDocument: "after" },
      );
      if (!tour) return { ok: false, error: "NOT_FOUND: Tour not found" };

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tour.rescheduled",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tourId: p.tourId, scheduledAt: p.scheduledAt },
      });
      return { ok: true, eventIds: [evtId], data: { tour } };
    }

    case "cmd.tour.cancel": {
      const p = CancelTourCmd.parse(cmd).payload;
      const tour = await col<Tour>(TOURS).findOneAndUpdate(
        { _id: p.tourId, tenantId: user.tenantId },
        { $set: { status: "cancelled", updatedAt: now } },
        { returnDocument: "after" },
      );
      if (!tour) return { ok: false, error: "NOT_FOUND: Tour not found" };

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tour.cancelled",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tourId: p.tourId },
      });
      return { ok: true, eventIds: [evtId], data: { tour } };
    }

    case "cmd.tour.complete": {
      const p = CompleteTourCmd.parse(cmd).payload;
      const tour = await col<Tour>(TOURS).findOneAndUpdate(
        { _id: p.tourId, tenantId: user.tenantId },
        { $set: { status: "completed", updatedAt: now } },
        { returnDocument: "after" },
      );
      if (!tour) return { ok: false, error: "NOT_FOUND: Tour not found" };
      // When a tour is completed, mark the lead's stage as `tour-done`.
      try {
        let leadId: string | null = null;
        if ((tour as any).leadId) {
          leadId = (tour as any).leadId;
        } else if ((tour as any).value && (tour as any).value.leadId) {
          leadId = (tour as any).value.leadId;
        }
        if (leadId) {
          // update lead stage to tour-done
          await col<Lead>("leads").updateOne(
            { _id: leadId, tenantId: user.tenantId },
            { $set: { stage: "tour-done", updatedAt: now } },
          );

          // auto-log an activity on the lead timeline
          await autoLogActivity({
            entityType: "lead",
            entityId: leadId,
            kind: "stage_changed",
            subject: `Tour completed`,
            body: `Tour ${p.tourId} completed by ${user.sub}`,
            meta: { tourId: p.tourId, completedBy: user.sub },
            user,
            correlationId,
          });
        }
      } catch (err) {
        // Non-fatal: continue even if lead update/logging fails
        console.warn("Failed to update lead stage or log activity on tour complete:", err);
      }

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tour.completed",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tourId: p.tourId },
      });
      return { ok: true, eventIds: [evtId], data: { tour } };
    }

    case "cmd.tour.update": {
      const p = UpdateTourCmd.parse(cmd).payload;
      if (Object.keys(p.patch).length === 0) return { ok: true };

      const tour = await col<Tour>(TOURS).findOne({ _id: p.tourId, tenantId: user.tenantId });
      if (!tour) return { ok: false, error: "NOT_FOUND: Tour not found" };

      await col<Tour>(TOURS).updateOne(
        { _id: p.tourId },
        { $set: { ...(p.patch as any), updatedAt: now } }
      );

      if ((p.patch as any).status === "no-show" && (tour as any).leadId) {
        await col<Lead>("leads").updateOne(
          { _id: (tour as any).leadId, tenantId: user.tenantId },
          { $set: { stage: "contacted", updatedAt: now } },
        );
      }

      await emit({
        _id: newEventId(),
        type: "evt.tour.updated",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tourId: tour._id, patch: p.patch },
      });
      return { ok: true };
    }

    case "cmd.tour.update_post_tour": {
      const p = UpdatePostTourCmd.parse(cmd).payload;
      const tour = await col<Tour>(TOURS).findOne({ _id: p.tourId, tenantId: user.tenantId });
      if (!tour) return { ok: false, error: "NOT_FOUND: Tour not found" };
      const updatedPostTour = { ...tour.postTour, ...p.patch } as PostTourUpdate;
      const updated = await col<Tour>(TOURS).findOneAndUpdate(
        { _id: p.tourId, tenantId: user.tenantId },
        { $set: { postTour: updatedPostTour, updatedAt: now } },
        { returnDocument: "after" },
      );
      if (!updated) return { ok: false, error: "NOT_FOUND: Tour not found" };
      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.tour.updated",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { tourId: p.tourId, patch: p.patch },
      });
      return { ok: true, eventIds: [evtId], data: { tour: updated } };
    }
  }
  throw Object.assign(new Error(`Unknown command type: ${(cmd as { type: string }).type}`), { code: "BAD_COMMAND" });
}
