/**
 * Assignment Notification Handlers
 *
 * When a lead is created/assigned, or a tour is scheduled, the intended assignee
 * receives a "pending assignment" notification instead of being immediately assigned.
 * They must Accept (claim it) or Pass on (send to another person).
 *
 * Schema (assignment_notifications collection):
 * {
 *   _id: string           - ULID
 *   tenantId: string
 *   type: "lead" | "tour"
 *   entityId: string      - leadId or tourId
 *   leadId: string        - always present (tours also carry their lead's id)
 *   leadName: string      - for display
 *   assignedById: string  - userId who triggered the assignment
 *   assignedByName: string
 *   assignedToId: string  - current pending assignee
 *   status: "pending" | "accepted" | "passed"
 *   passedToId?: string   - set when passed
 *   passedChain: string[] - ordered list of all assignedToIds (for cycle detection)
 *   createdAt: string
 *   updatedAt: string
 * }
 */

import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";
import type { UserDoc } from "../../auth/auth.js";
import type { Lead, Tour } from "../../../../src/contracts/entities.js";
import {
  AcceptLeadAssignmentCmd,
  PassLeadAssignmentCmd,
  AcceptTourAssignmentCmd,
  PassTourAssignmentCmd,
  type Command,
} from "../../../../src/contracts/commands.js";

const NOTIF_COL = "assignment_notifications";
const LEADS = "leads";
const TOURS = "tours";

export interface AssignmentNotificationDoc {
  _id: string;
  tenantId: string;
  type: "lead" | "tour";
  entityId: string;
  leadId: string;
  leadName: string;
  assignedById: string;
  assignedByName: string;
  assignedToId: string;
  status: "pending" | "accepted" | "passed";
  passedToId?: string;
  passedChain: string[];
  createdAt: string;
  updatedAt: string;
}

/** Create a pending assignment notification for a lead. */
export async function createLeadAssignmentNotification({
  leadId,
  leadName,
  assignedById,
  assignedByName,
  assignedToId,
  tenantId,
  passedChain = [],
}: {
  leadId: string;
  leadName: string;
  assignedById: string;
  assignedByName: string;
  assignedToId: string;
  tenantId: string;
  passedChain?: string[];
}): Promise<AssignmentNotificationDoc> {
  const now = new Date().toISOString();

  // Cancel any existing pending notifications for this lead → avoids orphaned records
  await col<AssignmentNotificationDoc>(NOTIF_COL).updateMany(
    { tenantId, entityId: leadId, type: "lead", status: "pending" },
    { $set: { status: "passed", updatedAt: now } },
  );

  const doc: AssignmentNotificationDoc = {
    _id: ulid(),
    tenantId,
    type: "lead",
    entityId: leadId,
    leadId,
    leadName,
    assignedById,
    assignedByName,
    assignedToId,
    status: "pending",
    passedChain: [...passedChain, assignedToId],
    createdAt: now,
    updatedAt: now,
  };

  await col<AssignmentNotificationDoc>(NOTIF_COL).insertOne(doc);
  return doc;
}

/** Create a pending assignment notification for a tour. */
export async function createTourAssignmentNotification({
  tourId,
  leadId,
  leadName,
  assignedById,
  assignedByName,
  assignedToId,
  tenantId,
  passedChain = [],
}: {
  tourId: string;
  leadId: string;
  leadName: string;
  assignedById: string;
  assignedByName: string;
  assignedToId: string;
  tenantId: string;
  passedChain?: string[];
}): Promise<AssignmentNotificationDoc> {
  const now = new Date().toISOString();

  // Cancel any existing pending notifications for this tour
  await col<AssignmentNotificationDoc>(NOTIF_COL).updateMany(
    { tenantId, entityId: tourId, type: "tour", status: "pending" },
    { $set: { status: "passed", updatedAt: now } },
  );

  const doc: AssignmentNotificationDoc = {
    _id: ulid(),
    tenantId,
    type: "tour",
    entityId: tourId,
    leadId,
    leadName,
    assignedById,
    assignedByName,
    assignedToId,
    status: "pending",
    passedChain: [...passedChain, assignedToId],
    createdAt: now,
    updatedAt: now,
  };

  await col<AssignmentNotificationDoc>(NOTIF_COL).insertOne(doc);
  return doc;
}

/** Helper: resolve a user's display name from the users collection */
async function getUserName(userId: string, tenantId: string): Promise<string> {
  const user = await col<UserDoc>("users").findOne({ _id: userId, tenantId });
  return user?.fullName ?? userId;
}

/** Handle accept/pass commands for both lead and tour assignments */
export async function applyAssignmentCommand(
  cmd: Command,
  user: JwtClaims,
): Promise<{ ok: true; eventIds: string[] } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.lead.accept_assignment": {
      const { notificationId } = AcceptLeadAssignmentCmd.parse(cmd).payload;

      const notif = await col<AssignmentNotificationDoc>(NOTIF_COL).findOne({
        _id: notificationId,
        tenantId: user.tenantId,
        assignedToId: user.sub,
        status: "pending",
        type: "lead",
      });
      if (!notif) return { ok: false, error: "NOT_FOUND: Notification not found or already resolved" };

      // Accept: set the assignee on the lead
      const r = await col<Lead>(LEADS).updateOne(
        { _id: notif.leadId, tenantId: user.tenantId },
        {
          $set: {
            assignedTcmId: user.sub,
            assigneeId: user.sub,
            updatedAt: now,
          },
          $inc: { __v: 1 } as any,
        },
      );
      if (r.matchedCount === 0) return { ok: false, error: "NOT_FOUND: Lead not found" };

      await col<AssignmentNotificationDoc>(NOTIF_COL).updateOne(
        { _id: notificationId },
        { $set: { status: "accepted", updatedAt: now } },
      );

      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.assigned", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { leadId: notif.leadId, tcmId: user.sub, originalAssignedById: notif.assignedById, assigneeName: user.fullName },
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.lead.pass_assignment": {
      const { notificationId, newAssigneeId } = PassLeadAssignmentCmd.parse(cmd).payload;

      const notif = await col<AssignmentNotificationDoc>(NOTIF_COL).findOne({
        _id: notificationId,
        tenantId: user.tenantId,
        assignedToId: user.sub,
        status: "pending",
        type: "lead",
      });
      if (!notif) return { ok: false, error: "NOT_FOUND: Notification not found or already resolved" };

      // Prevent self-loop
      if (newAssigneeId === user.sub) {
        return { ok: false, error: "VALIDATION_FAILED: Cannot pass to yourself" };
      }

      // Mark current notification as passed
      await col<AssignmentNotificationDoc>(NOTIF_COL).updateOne(
        { _id: notificationId },
        { $set: { status: "passed", passedToId: newAssigneeId, updatedAt: now } },
      );

      // Resolve new assignee's name for display
      const newAssigneeName = await getUserName(newAssigneeId, user.tenantId);

      // Create new pending notification for the new assignee
      await createLeadAssignmentNotification({
        leadId: notif.leadId,
        leadName: notif.leadName,
        assignedById: notif.assignedById,   // original assigner (chain kept)
        assignedByName: notif.assignedByName,
        assignedToId: newAssigneeId,
        tenantId: user.tenantId,
        passedChain: notif.passedChain,
      });

      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.lead.assignment_passed", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: {
          leadId: notif.leadId,
          passedById: user.sub,
          passedByName: user.fullName,
          passedToId: newAssigneeId,
          passedToName: newAssigneeName,
          originalAssignedById: notif.assignedById,
        },
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.tour.accept_assignment": {
      const { notificationId } = AcceptTourAssignmentCmd.parse(cmd).payload;

      const notif = await col<AssignmentNotificationDoc>(NOTIF_COL).findOne({
        _id: notificationId,
        tenantId: user.tenantId,
        assignedToId: user.sub,
        status: "pending",
        type: "tour",
      });
      if (!notif) return { ok: false, error: "NOT_FOUND: Notification not found or already resolved" };

      // Mark notification as accepted — tour's assignedTo is already correct in DB
      await col<AssignmentNotificationDoc>(NOTIF_COL).updateOne(
        { _id: notificationId },
        { $set: { status: "accepted", updatedAt: now } },
      );

      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.tour.assignment_accepted", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: { tourId: notif.entityId, tcmId: user.sub, leadId: notif.leadId, originalAssignedById: notif.assignedById, assigneeName: user.fullName },
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.tour.pass_assignment": {
      const { notificationId, newAssigneeId } = PassTourAssignmentCmd.parse(cmd).payload;

      const notif = await col<AssignmentNotificationDoc>(NOTIF_COL).findOne({
        _id: notificationId,
        tenantId: user.tenantId,
        assignedToId: user.sub,
        status: "pending",
        type: "tour",
      });
      if (!notif) return { ok: false, error: "NOT_FOUND: Notification not found or already resolved" };

      if (newAssigneeId === user.sub) {
        return { ok: false, error: "VALIDATION_FAILED: Cannot pass to yourself" };
      }

      // Update the tour's assignedTo to the new TCM
      await col<Tour>(TOURS).updateOne(
        { _id: notif.entityId, tenantId: user.tenantId },
        { $set: { assignedTo: newAssigneeId, updatedAt: now } },
      );

      // Mark current notification as passed
      await col<AssignmentNotificationDoc>(NOTIF_COL).updateOne(
        { _id: notificationId },
        { $set: { status: "passed", passedToId: newAssigneeId, updatedAt: now } },
      );

      const newAssigneeName = await getUserName(newAssigneeId, user.tenantId);

      // Create new pending notification for the new TCM
      await createTourAssignmentNotification({
        tourId: notif.entityId,
        leadId: notif.leadId,
        leadName: notif.leadName,
        assignedById: notif.assignedById,
        assignedByName: notif.assignedByName,
        assignedToId: newAssigneeId,
        tenantId: user.tenantId,
        passedChain: notif.passedChain,
      });

      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.tour.assignment_passed", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null, version: 1,
        payload: {
          tourId: notif.entityId,
          leadId: notif.leadId,
          passedById: user.sub,
          passedByName: user.fullName,
          passedToId: newAssigneeId,
          passedToName: newAssigneeName,
          originalAssignedById: notif.assignedById,
        },
      });

      return { ok: true, eventIds: [evtId] };
    }

    default:
      return { ok: false, error: `BAD_COMMAND: Not an assignment command: ${(cmd as any).type}` };
  }
}

/** Fetch all pending assignment notifications for a given user */
export async function getPendingAssignmentsForUser(
  userId: string,
  tenantId: string,
): Promise<AssignmentNotificationDoc[]> {
  return col<AssignmentNotificationDoc>(NOTIF_COL)
    .find({ tenantId, assignedToId: userId, status: { $in: ["pending", "accepted"] } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
}

/** Fetch assignment notifications sent BY a given user that have been passed on (so they know) */
export async function getPassedNotificationsForUser(
  userId: string,
  tenantId: string,
  limit = 20,
): Promise<AssignmentNotificationDoc[]> {
  return col<AssignmentNotificationDoc>(NOTIF_COL)
    .find({ tenantId, assignedById: userId, status: "passed" })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
}
