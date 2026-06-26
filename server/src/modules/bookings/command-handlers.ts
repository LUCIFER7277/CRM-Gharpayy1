import { col } from "../../db/mongo.js";
import { ulid } from "../../../../src/contracts/ids.js";
import {
  CreateBookingCmd,
  UpdateBookingCmd,
  CancelBookingCmd,
  ApproveBookingCmd,
  MarkBookingPaidCmd,
  type Command,
} from "../../../../src/contracts/commands.js";
import { BookingEntity } from "../../../../src/contracts/entities.js";
import { emit, newEventId } from "../../realtime/event-bus.js";
import type { JwtClaims } from "../../auth/auth.js";

const BOOKINGS = "bookings";

/**
 * Look up the ownerId for a given property. Returns null if no owner is linked.
 */
async function resolveOwnerId(propertyId: string, tenantId: string): Promise<string | null> {
  const prop = await col("properties").findOne({ _id: propertyId, tenantId });
  return (prop as any)?.ownerId ?? null;
}

function historyEntry(actor: string, text: string) {
  return { ts: new Date().toISOString(), actor, text };
}

export async function applyBookingCommand(cmd: Command, user: JwtClaims) {
  const now = new Date().toISOString();
  const correlationId = cmd._id;

  switch (cmd.type) {
    case "cmd.booking.create": {
      const p = CreateBookingCmd.parse(cmd).payload;

      // Check for existing active booking for this lead
      const existing = await col(BOOKINGS).findOne({
        leadId: p.leadId,
        status: { $ne: "cancelled" },
        tenantId: user.tenantId,
      });
      if (existing) {
        return { ok: true, data: { duplicate: true, booking: existing } };
      }

      // Auto-resolve ownerId from property → owner link
      const ownerId = await resolveOwnerId(p.propertyId, user.tenantId);

      const booking = BookingEntity.parse({
        _id: ulid(),
        leadId: p.leadId,
        tourId: p.tourId,
        propertyId: p.propertyId,
        ownerId,
        tcmId: p.tcmId,
        amount: p.amount,
        tenantName: p.tenantName,
        tenantPhone: p.tenantPhone,
        deposit: p.deposit,
        moveInDate: p.moveInDate,
        status: "pending",
        ownerLifecycle: "created",
        history: [historyEntry(`sales:${user.sub}`, "Booking created")],
        notes: p.notes ?? "",
        tenantId: user.tenantId,
        createdAt: now,
        updatedAt: now,
      });

      await col(BOOKINGS).insertOne({ ...booking, __v: 1 });

      const evtId = newEventId();
      await emit({
        _id: evtId,
        type: "evt.booking.created",
        occurredAt: now,
        actor: user.sub,
        tenantId: user.tenantId,
        correlationId,
        causationId: null,
        version: 1,
        payload: { booking },
      });

      const { autoLogActivity } = await import("../activities/command-handlers.js");
      await autoLogActivity({
        entityType: "lead",
        entityId: p.leadId,
        kind: "created",
        subject: `Booking created`,
        body: `Booking created for property ${p.propertyId} with deposit ₹${p.deposit}`,
        meta: { bookingId: booking._id, propertyId: p.propertyId },
        user,
        correlationId,
      });

      return { ok: true, eventIds: [evtId], data: { booking } };
    }

    case "cmd.booking.update": {
      const p = UpdateBookingCmd.parse(cmd).payload;
      const patch = { ...p.patch, updatedAt: now };
      const bookingBefore = await col(BOOKINGS).findOne({ _id: p.bookingId, tenantId: user.tenantId });
      const r = await col(BOOKINGS).updateOne(
        { _id: p.bookingId, tenantId: user.tenantId },
        {
          $set: patch,
          $push: { history: historyEntry(user.sub, "Booking updated") as any },
          $inc: { __v: 1 },
        },
      );
      if (r.matchedCount === 0) return { ok: false, error: "NOT_FOUND: Booking not found" };
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.booking.updated", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null,
        version: 1, payload: { bookingId: p.bookingId, patch },
      });

      const { autoLogActivity } = await import("../activities/command-handlers.js");
      await autoLogActivity({
        entityType: "lead",
        entityId: (bookingBefore as any)?.leadId || p.bookingId,
        kind: "field_changed",
        subject: `Booking updated`,
        body: `Updated fields: ${Object.keys(p.patch).join(", ")}`,
        meta: { bookingId: p.bookingId, patch: p.patch },
        user,
        correlationId,
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.booking.cancel": {
      const p = CancelBookingCmd.parse(cmd).payload;
      const cancelledBooking = await col(BOOKINGS).findOne({ _id: p.bookingId, tenantId: user.tenantId });
      const r = await col(BOOKINGS).updateOne(
        { _id: p.bookingId, tenantId: user.tenantId },
        {
          $set: { status: "cancelled", ownerLifecycle: "cancelled", updatedAt: now },
          $push: { history: historyEntry(user.sub, "Booking cancelled") as any },
          $inc: { __v: 1 },
        },
      );
      if (r.matchedCount === 0) return { ok: false, error: "NOT_FOUND: Booking not found" };
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.booking.cancelled", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null,
        version: 1, payload: { bookingId: p.bookingId },
      });

      const { autoLogActivity: logCancel } = await import("../activities/command-handlers.js");
      await logCancel({
        entityType: "lead",
        entityId: (cancelledBooking as any)?.leadId || p.bookingId,
        kind: "stage_changed",
        subject: `Booking cancelled`,
        body: `Booking ${p.bookingId} was cancelled`,
        meta: { bookingId: p.bookingId, propertyId: (cancelledBooking as any)?.propertyId },
        user,
        correlationId,
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.booking.approve": {
      const p = ApproveBookingCmd.parse(cmd).payload;
      const approvedBooking = await col(BOOKINGS).findOne({ _id: p.bookingId, tenantId: user.tenantId });
      const r = await col(BOOKINGS).updateOne(
        { _id: p.bookingId, tenantId: user.tenantId },
        {
          $set: { status: "approved", updatedAt: now },
          $push: { history: historyEntry(user.sub, "Booking approved") as any },
          $inc: { __v: 1 },
        },
      );
      if (r.matchedCount === 0) return { ok: false, error: "NOT_FOUND: Booking not found" };
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.booking.approved", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null,
        version: 1, payload: { bookingId: p.bookingId },
      });

      const { autoLogActivity: logApprove } = await import("../activities/command-handlers.js");
      await logApprove({
        entityType: "lead",
        entityId: (approvedBooking as any)?.leadId || p.bookingId,
        kind: "stage_changed",
        subject: `Booking approved`,
        body: `Booking ${p.bookingId} approved`,
        meta: { bookingId: p.bookingId, propertyId: (approvedBooking as any)?.propertyId },
        user,
        correlationId,
      });

      return { ok: true, eventIds: [evtId] };
    }

    case "cmd.booking.mark_paid": {
      const p = MarkBookingPaidCmd.parse(cmd).payload;
      const booking = await col(BOOKINGS).findOne({ _id: p.bookingId, tenantId: user.tenantId });
      if (!booking) return { ok: false, error: "NOT_FOUND: Booking not found" };
      await col(BOOKINGS).updateOne(
        { _id: p.bookingId, tenantId: user.tenantId },
        {
          $set: { status: "active", paidRef: p.paidRef, updatedAt: now },
          $push: { history: historyEntry(user.sub, `Payment received: ${p.paidRef}`) as any },
          $inc: { __v: 1 },
        },
      );
      const evtId = newEventId();
      await emit({
        _id: evtId, type: "evt.booking.marked_paid", occurredAt: now,
        actor: user.sub, tenantId: user.tenantId, correlationId, causationId: null,
        version: 1, payload: { bookingId: p.bookingId, paidRef: p.paidRef },
      });

      const { autoLogActivity: logPaid } = await import("../activities/command-handlers.js");
      await logPaid({
        entityType: "lead",
        entityId: (booking as any)?.leadId || p.bookingId,
        kind: "payment_recorded",
        subject: `Booking payment received`,
        body: `Payment ref: ${p.paidRef} for booking ${p.bookingId}`,
        meta: { bookingId: p.bookingId, paidRef: p.paidRef, propertyId: (booking as any)?.propertyId },
        user,
        correlationId,
      });

      return { ok: true, eventIds: [evtId], data: { booking: { ...booking, status: "active", paidRef: p.paidRef } } };
    }
  }
  throw Object.assign(new Error(`Unknown command type: ${(cmd as { type: string }).type}`), { code: "BAD_COMMAND" });
}
